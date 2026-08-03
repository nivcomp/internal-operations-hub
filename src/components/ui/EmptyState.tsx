import type { ReactNode } from "react";

type EmptyStateProps = {
  /** What this area is. */
  title: string;
  /** Why it is empty and what happens next. */
  description: string;
  /** Primary next step. */
  action?: { label: string; onClick: () => void; disabled?: boolean };
  secondaryAction?: { label: string; onClick: () => void };
  icon?: ReactNode;
  compact?: boolean;
};

export function EmptyState({ title, description, action, secondaryAction, icon, compact }: EmptyStateProps) {
  return (
    <div className={`empty-state${compact ? " inline-empty-state" : ""}`}>
      {icon ? <div className="empty-state-icon" aria-hidden>{icon}</div> : null}
      <h3>{title}</h3>
      <p>{description}</p>
      {action || secondaryAction ? (
        <div className="action-row compact">
          {action ? (
            <button className="primary-button" type="button" onClick={action.onClick} disabled={action.disabled}>
              {action.label}
            </button>
          ) : null}
          {secondaryAction ? (
            <button type="button" onClick={secondaryAction.onClick}>{secondaryAction.label}</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}