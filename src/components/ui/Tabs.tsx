import type { ReactNode } from "react";

export type TabDef<T extends string> = {
  key: T;
  label: string;
  /** Small counter or status hint rendered next to the label. */
  badge?: ReactNode;
  /** Draws attention to tabs that need the user to do something. */
  attention?: boolean;
};

type TabsProps<T extends string> = {
  tabs: TabDef<T>[];
  active: T;
  onChange: (key: T) => void;
  ariaLabel: string;
};

/**
 * Horizontal, scrollable tab bar used to turn long detail pages into a single
 * workspace with progressive disclosure. Purely presentational.
 */
export function Tabs<T extends string>({ tabs, active, onChange, ariaLabel }: TabsProps<T>) {
  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          className={`tab${active === tab.key ? " active" : ""}${tab.attention ? " attention" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          <span>{tab.label}</span>
          {tab.badge !== undefined && tab.badge !== null && tab.badge !== "" ? (
            <span className="tab-badge">{tab.badge}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}