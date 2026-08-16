import { useState, type ReactNode } from "react";
import { useMode, type SimpleView } from "../../context/ModeContext";

const navItems: { key: SimpleView; label: string }[] = [
  { key: "home", label: "בית" },
  { key: "crm", label: "לידים" },
  { key: "lead-conversations", label: "שיחות לידים" },
  { key: "clients", label: "לקוחות" },
  { key: "projects", label: "פרויקטים" },
  { key: "suppliers", label: "ספקים" },
  { key: "tasks", label: "משימות" },
  { key: "finance", label: "כספים" },
  { key: "cash-flow-leads", label: "לידים תזרים" },
];

type Props = {
  accountLabel: string;
  onSignOut: () => void;
  children: ReactNode;
};

/** Hebrew-first RTL shell for Simple Mode. */
export function SimpleLayout({ accountLabel, onSignOut, children }: Props) {
  const { simpleView, setSimpleView, setMode, openAdvanced } = useMode();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="simple-shell" dir="rtl" lang="he">
      <header className="simple-topbar">
        <div className="simple-brand">
          <span className="brand-mark">CS</span>
          <div>
            <strong>מרכז הבקרה</strong>
            <span>{accountLabel}</span>
          </div>
        </div>
        <nav className="simple-nav" aria-label="ניווט ראשי">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={simpleView === item.key ? "active" : ""}
              onClick={() => setSimpleView(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="simple-topbar-actions">
          <button type="button" className="ghost-button" onClick={() => setMode("advanced")}>
            מערכת מלאה
          </button>
          <button type="button" className="ghost-button" onClick={() => setMenuOpen((open) => !open)} aria-label="חשבון">
            ⋯
          </button>
          {menuOpen ? (
            <div className="simple-menu">
              <button type="button" onClick={() => { setMenuOpen(false); openAdvanced("api-integrations"); }}>API ואינטגרציות</button>
              <button type="button" onClick={onSignOut}>התנתקות</button>
            </div>
          ) : null}
        </div>
      </header>
      <main className="simple-main">{children}</main>
    </div>
  );
}
