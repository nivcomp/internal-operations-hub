import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ViewKey } from "../views";
import { views } from "../views";

type LayoutProps = {
  activeView: ViewKey;
  onNavigate: (view: ViewKey) => void;
  children: ReactNode;
};

type NavGroup = { label: string; keys: ViewKey[] };

const navGroups: NavGroup[] = [
  { label: "Overview", keys: ["dashboard", "action-queue"] },
  { label: "Clients", keys: ["clients", "client-detail", "client-portal"] },
  { label: "Projects", keys: ["projects", "project-detail", "change-requests"] },
  { label: "Suppliers", keys: ["suppliers", "supplier-detail", "supplier-time", "supplier-portal"] },
  { label: "Finance", keys: ["pricing-margin", "payments-hours"] },
  { label: "Tools", keys: ["ai-workbench"] },
];

const labelFor = (key: ViewKey) =>
  views.find((v) => v.key === key)?.label ?? key;

export function Layout({ activeView, onNavigate, children }: LayoutProps) {
  const activeGroup = useMemo(
    () => navGroups.find((g) => g.keys.includes(activeView))?.label,
    [activeView],
  );
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navGroups.map((g) => [g.label, g.label === (activeGroup ?? "Overview")])),
  );

  useEffect(() => {
    if (!activeGroup) return;
    setOpenGroups((prev) => (prev[activeGroup] ? prev : { ...prev, [activeGroup]: true }));
  }, [activeGroup]);

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CS</div>
          <div>
            <strong>Client-to-Scope AI</strong>
            <span>Internal OS for Yaniv</span>
          </div>
        </div>
        <nav className="nav-groups" aria-label="Internal app navigation">
          {navGroups.map((group) => {
            const isOpen = openGroups[group.label] ?? false;
            const hasActive = group.keys.includes(activeView);
            return (
              <div key={group.label} className={`nav-group${hasActive ? " has-active" : ""}`}>
                <button
                  type="button"
                  className="nav-group-header"
                  aria-expanded={isOpen}
                  onClick={() => toggleGroup(group.label)}
                >
                  <span>{group.label}</span>
                  <span className={`nav-chevron${isOpen ? " open" : ""}`} aria-hidden>▸</span>
                </button>
                {isOpen ? (
                  <div className="nav-list">
                    {group.keys.map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={activeView === key ? "active" : ""}
                        onClick={() => onNavigate(key)}
                      >
                        {labelFor(key)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>
      <main className="main-panel">{children}</main>
    </div>
  );
}
