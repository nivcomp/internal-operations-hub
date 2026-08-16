# אפיון API חיצוני למערכת

## מה החבילה הזאת נותנת

הספרייה הזאת היא מקור אמת לבניית API חיצוני ו־AI Skill עבור Client-to-Scope AI. היא כוללת:

- חוזה OpenAPI מלא לכניסה, גילוי סכימה, קריאה, יצירה, עריכה, מחיקה מבוקרת ופעולות עסקיות.
- קטלוג שנוצר אוטומטית מהסכימה האמיתית: 82 טבלאות, שדות `Row`/`Insert`/`Update`, קשרים ו־9 פונקציות מסד.
- מפת הרשאות לפי תפקיד, תחום וטבלה.
- מלאי 12 Edge Functions והפעולות העסקיות הקיימות בהן.
- קובץ יחיד שאפשר למסור למנוע AI כדי שייצר Connector/Skill.

חשוב: זהו **חוזה תכנון**, לא כתובת API חיה. המערכת היום משתמשת ישירות ב־Supabase מהאפליקציה וב־Edge Functions. לפני שמחברים גורם חיצוני יש לממש Gateway לפי `openapi.json`, לפרוס אותו, ולהנפיק לו הרשאות מצומצמות. אין למסור ל־Skill את מפתח `service_role` של Supabase.

## קבצי החבילה

| קובץ | שימוש |
|---|---|
| `ai-skill-input.json` | הקובץ היחיד להעלאה למנוע AI; מכיל את כל שאר החוזים והנחיית היצירה |
| `openapi.json` | חוזה OpenAPI 3.1 למימוש וליצירת SDK/Connector |
| `table-catalog.json` | הסכימה המלאה שנגזרה מ־`src/integrations/supabase/types.ts` |
| `permissions-matrix.json` | הרשאות, גבולות שורה, מדיניות כתיבה ומחיקה לכל טבלה |
| `business-actions.json` | Edge Functions, RPCs ופעולות שחייבות להישאר מבוקרות |
| `ai-skill-generator-prompt.md` | Prompt קצר להדבקה כאשר המנוע מקבל קבצים בנפרד |

את ארבעת קובצי ה־JSON המכניים מייצרים מחדש באמצעות `pnpm run api:docs`. תהליך הייצור נכשל אם טבלה חדשה לא סווגה במפת ההרשאות, כדי למנוע פרסום שקט של נתונים חדשים ללא מדיניות.

## ארכיטקטורה מוצעת

```text
AI Skill / Connector
        |
        | OAuth2 token with narrow scopes
        v
External API Gateway
  - validates schema and fields
  - resolves application role and tenant
  - enforces permissions + row ownership
  - requires confirmation/idempotency/ETag
  - records immutable audit event
        |
        +--> Supabase Postgres (RLS remains enabled)
        |
        +--> Existing Edge Functions / guarded RPCs
```

ה־Gateway הוא שכבת האמון. הוא אינו מחליף RLS אלא מוסיף מעליו scopes, הגבלת קצב, אימות שדות, אישור לפעולות מסוכנות ותיעוד מלא.

## התחברות והרשאות

הדרך המועדפת לחיבור שרת או Skill היא OAuth 2.0 Client Credentials עם access token קצר־חיים. לכל אינטגרציה מגדירים:

- `API_BASE_URL`
- `CLIENT_ID`
- `CLIENT_SECRET` בתוך secret manager בלבד
- scopes מינימליים: `schema.read`, `data.read`, `data.write`, `data.delete`, `actions.execute`, `audit.read`
- תפקיד אפליקטיבי וגבול שורות: `agency_admin`, לקוח מסוים, ספק מסוים, או service account מצומצם

לאחר קבלת token, ה־Connector חייב לקרוא `GET /v1/me` ואז `GET /v1/schema/tables`. התשובה היא ההרשאה האפקטיבית; עצם הופעת טבלה בקטלוג אינה מעניקה אליה גישה.

## פעולות CRUD

### קריאה

`GET /v1/data/{table}` תומך בבחירת שדות, סינון מובנה, סדר, `limit` עד 200 ו־cursor. אין להעביר SQL או ביטויי PostgREST חופשיים; ה־Gateway מקבל Filter AST ומאמת כל עמודה ואופרטור.

דוגמת סינון רעיונית:

```json
{
  "and": [
    { "field": "status", "op": "eq", "value": "active" },
    { "field": "updated_at", "op": "gte", "value": "2026-01-01T00:00:00Z" }
  ]
}
```

### יצירה ועריכה

כל mutation מקבל `Idempotency-Key`. עריכה דורשת גם `If-Match` מה־ETag של הקריאה האחרונה, כדי למנוע דריסה של שינוי מקביל. שדות מערכת, תפקיד, tenant, בעלות ושדות בלתי־ניתנים לשינוי אינם מתקבלים מהלקוח.

### מחיקה

החוזה כולל `DELETE`, אך לא כל טבלה ניתנת למחיקה קשיחה:

- לוגים, הודעות, אישורים, חתימות ותשלומים הם append-only; מתקנים אותם באירוע תיקון/ביטול חדש.
- `project_pricing` ו־`phase_pricing` הן טבלאות היסטוריות לקריאה בלבד.
- מחיקה מותרת דורשת scope של `data.delete`, תפקיד מתאים, `If-Match`, `Idempotency-Key`, הכותרת `X-Confirm-Delete: DELETE` וסיבה כתובה.
- ברירת המחדל היא soft delete/archive כאשר המודל תומך בכך.

כך נשמרת יכולת ניהול מלאה בלי לאפשר ל־AI להעלים היסטוריה עסקית או כספית.

## פעולות עסקיות במקום כתיבה גולמית

הפעולות ב־`business-actions.json` עוטפות תהליכים שבהם כתיבה לטבלה אחת אינה מספיקה. יש להשתמש בהן עבור:

- קידום ליד לפרויקט והחלטת שער תשלום.
- פרסום/אישור scope, מחיר או הצעה.
- שיוך ספק ועלות ספק.
- יצירה, שיתוף, אישור או פתיחה מחדש של MVP/prototype.
- חתימה על הצעה ויצירת חבילת ביצוע.
- אישורים, תשלומים, עקיפות תשלום ומחיקות מוגנות.

הפעולה יכולה להחזיר `pending_confirmation` במקום לבצע מיד. ה־Skill חייב להציג למפעיל את היעד, השינוי וההשפעה ולקבל אישור מפורש.

## כללים עסקיים שאסור לאינטגרציה לעקוף

- החלטות סופיות על scope, מחיר, עלות ספק, שיוך ספק, נראות ומוכנות נשארות בשליטת מנהל הסוכנות.
- פרויקט אינו מתחיל בלי scope מאושר, תשלום/בנק שעות או עקיפה מפורשת ומתועדת, וספק משויך.
- AI יכול להציע טיוטות וסיווגים; הוא אינו מאשר או מפרסם בשם אדם ללא פעולה מוגנת.
- לקוח רואה רק את הלקוח והפרויקטים שלו ורק רשומות המיועדות ללקוח.
- ספק רואה רק את עצמו, פרויקטים שהוקצו לו ורשומות המיועדות לספק.
- 403 הוא סוף ההרשאה: אין לנסות token חזק יותר, endpoint עוקף או גישה ישירה למסד.

## מודל שגיאות ותפעול

כל שגיאה מחזירה `error.code`, הודעה, `requestId` ודגל `retryable`. ה־Connector שומר `requestId` לצורכי תמיכה, מכבד `Retry-After`, ומנסה שוב רק פעולות idempotent. כל mutation יוצר audit event עם זהות האינטגרציה, זהות המשתמש, היעד, hash של הקלט, התוצאה והסיבה לפעולות מוגנות.

## סדר מימוש מומלץ

1. להקים Gateway מאומת ולממש `GET /v1/me` וגילוי סכימה.
2. לממש קריאה עם RLS/גבולות tenant ו־field allowlist.
3. לממש create/patch עם validation, idempotency ו־ETag.
4. לעטוף את הפעולות העסקיות הקיימות ולחבר audit מלא.
5. להוסיף guarded delete רק לטבלאות שמפת ההרשאות מאפשרת.
6. להריץ בדיקות חוזה עם חשבונות admin, client ו־supplier ונתוני בדיקה בלבד.
7. רק לאחר מכן לייצר Skill מ־`ai-skill-input.json` ולהנפיק לו credentials מצומצמים.

## מה נדרש כדי להפוך את החוזה לחיבור עובד

ה־Skill שייווצר אינו יכול להתחבר עד שיש כתובת Gateway חיה, מנפיק OAuth, אחסון secrets, audit storage ומימוש endpoints בהתאם ל־OpenAPI. אין כאן secrets, מפתחות ייצור או נתוני לקוחות — בכוונה.
