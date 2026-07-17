import type { ReactNode } from "react";
import type { ViewKey } from "../views";
import { views } from "../views";

type LayoutProps = {
  activeView: ViewKey;
  onNavigate: (view: ViewKey) => void;
  children: ReactNode;
};

export function Layout({ activeView, onNavigate, children }: LayoutProps) {
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
        <nav className="nav-list" aria-label="Internal app navigation">
          {views.map((view) => (
            <button
              key={view.key}
              type="button"
              className={activeView === view.key ? "active" : ""}
              onClick={() => onNavigate(view.key)}
            >
              {view.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main-panel">{children}</main>
    </div>
  );
}
