import { useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "../context/AppDataContext";
import { useNav } from "../context/NavContext";
import { views, type ViewKey } from "../views";

type Entry = {
  id: string;
  group: string;
  label: string;
  sublabel?: string;
  run: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

const RECENT_SEARCH_KEY = "cs-recent-searches";

function readRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCH_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

/** Global search across clients, projects, suppliers and pages (Cmd/Ctrl + K). */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const nav = useNav();
  const { clients, projects, suppliers } = useAppData();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readRecentSearches());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      window.setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];
    for (const project of projects) {
      const client = clients.find((item) => item.id === project.clientId);
      list.push({
        id: `project-${project.id}`,
        group: "Projects",
        label: project.name,
        sublabel: client?.company,
        run: () => nav.openProject(project.id),
      });
    }
    for (const client of clients) {
      list.push({
        id: `client-${client.id}`,
        group: "Clients",
        label: client.company,
        sublabel: client.name,
        run: () => nav.openClient(client.id),
      });
    }
    for (const supplier of suppliers) {
      list.push({
        id: `supplier-${supplier.id}`,
        group: "Suppliers",
        label: supplier.name,
        sublabel: supplier.status,
        run: () => nav.openSupplier(supplier.id),
      });
    }
    for (const view of views) {
      if (!nav.allowedViews.includes(view.key as ViewKey)) continue;
      list.push({
        id: `view-${view.key}`,
        group: "Go to",
        label: view.label,
        run: () => nav.navigate(view.key as ViewKey),
      });
    }
    return list;
  }, [clients, projects, suppliers, nav]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      const recentEntries = nav.recents
        .map((recent) => entries.find((entry) => entry.id === `${recent.kind}-${recent.id}`))
        .filter((entry): entry is Entry => Boolean(entry))
        .map((entry) => ({ ...entry, group: "Recent" }));
      const pages = entries.filter((entry) => entry.group === "Go to").slice(0, 8);
      return [...recentEntries, ...pages].slice(0, 12);
    }
    return entries
      .filter((entry) => `${entry.label} ${entry.sublabel ?? ""} ${entry.group}`.toLowerCase().includes(needle))
      .slice(0, 20);
  }, [entries, query, nav.recents]);

  function rememberSearch(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recentSearches.filter((item) => item !== trimmed)].slice(0, 5);
    setRecentSearches(next);
    try { window.localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  }

  function choose(entry: Entry) {
    rememberSearch(query);
    entry.run();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="dialog-backdrop palette-backdrop" role="presentation" onClick={onClose}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search" onClick={(event) => event.stopPropagation()}>
        <div className="palette-input">
          <span aria-hidden>⌕</span>
          <input
            ref={inputRef}
            value={query}
            placeholder="Search projects, clients, suppliers or pages…"
            aria-label="Search projects, clients, suppliers or pages"
            onChange={(event) => { setQuery(event.target.value); setCursor(0); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
              if (event.key === "ArrowUp") { event.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              if (event.key === "Enter" && results[cursor]) { event.preventDefault(); choose(results[cursor]); }
              if (event.key === "Escape") onClose();
            }}
          />
          <kbd>Esc</kbd>
        </div>

        {!query && recentSearches.length ? (
          <div className="palette-recent">
            <span className="muted-text">Recent searches</span>
            {recentSearches.map((item) => (
              <button key={item} type="button" className="chip" onClick={() => setQuery(item)}>{item}</button>
            ))}
          </div>
        ) : null}

        <div className="palette-results">
          {results.length === 0 ? (
            <p className="muted-text palette-empty">Nothing matches “{query}”. Try a project, client or supplier name.</p>
          ) : (
            results.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                className={`palette-item${index === cursor ? " active" : ""}`}
                onMouseEnter={() => setCursor(index)}
                onClick={() => choose(entry)}
              >
                <span className="palette-group">{entry.group}</span>
                <span className="palette-label">{entry.label}</span>
                {entry.sublabel ? <span className="palette-sub">{entry.sublabel}</span> : null}
              </button>
            ))
          )}
        </div>
        <div className="palette-footer muted-text">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>⌘</kbd><kbd>K</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}