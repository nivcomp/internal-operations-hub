import { useNav } from "../context/NavContext";
import type { ViewKey } from "../views";

export type Crumb = { label: string; view?: ViewKey; onClick?: () => void };

type DetailNavProps = {
  crumbs: Crumb[];
  /** Sibling record navigation, e.g. previous / next project. */
  siblings?: {
    previous?: { label: string; onClick: () => void };
    next?: { label: string; onClick: () => void };
    position?: string;
  };
};

/**
 * Consistent detail-page navigation: back, breadcrumbs, home and prev/next.
 * Navigation only — it never mutates records.
 */
export function DetailNav({ crumbs, siblings }: DetailNavProps) {
  const nav = useNav();
  const homeView = nav.allowedViews[0];

  return (
    <div className="detail-nav no-print">
      <div className="detail-nav-left">
        <button type="button" className="ghost-button" onClick={nav.goBack} disabled={!nav.canGoBack} title="Back (Alt+←)">
          <span aria-hidden>←</span> Back
        </button>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <button type="button" className="crumb" onClick={() => nav.navigate(homeView)}>Home</button>
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            const activate = crumb.onClick ?? (crumb.view ? () => nav.navigate(crumb.view!) : undefined);
            return (
              <span key={`${crumb.label}-${index}`} className="crumb-group">
                <span className="crumb-sep" aria-hidden>/</span>
                {isLast || !activate ? (
                  <span className="crumb current" aria-current="page">{crumb.label}</span>
                ) : (
                  <button type="button" className="crumb" onClick={activate}>{crumb.label}</button>
                )}
              </span>
            );
          })}
        </nav>
      </div>
      {siblings && (siblings.previous || siblings.next) ? (
        <div className="detail-nav-right">
          {siblings.position ? <span className="muted-text">{siblings.position}</span> : null}
          <button
            type="button"
            className="ghost-button"
            disabled={!siblings.previous}
            title={siblings.previous?.label ?? "No previous record"}
            onClick={() => siblings.previous?.onClick()}
          >
            <span aria-hidden>‹</span> Previous
          </button>
          <button
            type="button"
            className="ghost-button"
            disabled={!siblings.next}
            title={siblings.next?.label ?? "No next record"}
            onClick={() => siblings.next?.onClick()}
          >
            Next <span aria-hidden>›</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}