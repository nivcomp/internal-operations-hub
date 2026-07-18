## מטרה

לתקן את המסך הלבן ב־preview ולוודא שגם אם קריאת רשת נכשלת המשתמש רואה הודעה ברורה במקום עמוד ריק.

## אבחון

- `src/data/mockData.ts` מבצע `await Promise.all([...19 fetches])` ב־top-level.
- זה רץ בזמן טעינת המודול, לפני שה־UI מספיק להעלות מסך Loading או Error.
- אם קריאה אחת נכשלת (RLS, GRANT חסר, שגיאת רשת, backend cold-start) → המודול נכשל → `main.tsx` לא מרנדר → מסך לבן שקט בלי שגיאה גלויה למשתמש.
- בסביבת הסנדבוקס הקריאות הצליחו והדשבורד נטען מלא, כלומר הקוד עצמו תקין — התבנית פשוט שבירה מדי לפרודקשן.

## מה משתנה

### 1. הסרת ה־top-level await מ־`src/data/mockData.ts`
- להסיר את בלוק `await Promise.all(...)` ואת ה־exports שנשענים עליו.
- להשאיר את ה־exports הסטטיים היחידים שנשארו רלוונטיים: `agency`, `users`.
- להחליף כל שאר ה־exports (`suppliers`, `supplierProfiles`, וכו') במערכים ריקים ראשוניים (`export let suppliers: Supplier[] = []`) שיאוכלסו דרך פונקציית `hydrateStaticCollections()` הנקראת מ־`App.tsx` בתוך `loadAll()` הקיים.
- כך שום עמוד קיים לא נשבר (אותם שמות imports), אבל אף fetch לא רץ בזמן טעינת מודול.

### 2. הרחבת `loadAll` ב־`src/App.tsx`
- להוסיף קריאה ל־`hydrateStaticCollections()` בתוך אותו `Promise.all` שכבר מטפל ב־loading / error / retry UI.
- כל כשל יופיע עכשיו במסך "Could not load data" הקיים במקום מסך לבן.

### 3. Error boundary ברמת ה־root
- להוסיף `src/components/ErrorBoundary.tsx` פשוט (class component) שעוטף את `<App />` ב־`main.tsx` ומציג הודעה + כפתור Reload אם משהו לא צפוי נזרק בזמן ריצה.
- כך גם bug עתידי לא ייצור מסך לבן שקט.

### 4. בדיקה
- `pnpm run build`.
- להריץ Playwright מול `http://localhost:8080` ולוודא שהדשבורד עדיין נטען עם הנתונים האמיתיים.
- להריץ שנית עם simulate של כשל ברשת (blocking supabase URL) ולוודא שרואים את מסך ה־Error במקום עמוד לבן.

## מה לא משתנה

- אין שינויי UI, workflow, permissions, RTL, או logic.
- אין שינוי סכמה, RLS או policies.
- אין הוספת auth, AI, payments, notifications.
- אין שינוי בקריאות שירות ב־`services/api.ts` או במיפויים.

## סיכונים

- אם עמוד כלשהו קורא ל־collection מ־`mockData` לפני ש־`hydrateStaticCollections` רץ, הוא יראה מערך ריק לרגע. זה מקובל כי `App.tsx` ממילא מציג את מסך ה־Loading עד ש־`loadAll` מסתיים, ואף עמוד לא מרונדר לפני זה.

## הערכת גודל

שינוי ממוקד ב־3 קבצים (`mockData.ts`, `App.tsx`, `main.tsx`) + הוספת `ErrorBoundary.tsx`. build אחד, אימות ויזואלי אחד.
