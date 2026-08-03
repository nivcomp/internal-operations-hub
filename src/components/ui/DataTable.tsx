import { useMemo, useState, type ReactNode } from "react";

export type Column<Row> = {
  key: string;
  header: string;
  /** Cell renderer. */
  render: (row: Row) => ReactNode;
  /** Value used for sorting and search. Omit to make the column unsortable. */
  sortValue?: (row: Row) => string | number;
  align?: "start" | "end";
  /** Hidden below the tablet breakpoint to keep mobile rows readable. */
  hideOnMobile?: boolean;
};

type DataTableProps<Row> = {
  rows: Row[];
  columns: Column<Row>[];
  rowKey: (row: Row) => string;
  /** Free-text search across these fields. Omit to hide the search box. */
  searchFields?: (row: Row) => string;
  searchPlaceholder?: string;
  onRowClick?: (row: Row) => void;
  /** Quick actions revealed on row hover / focus. */
  rowActions?: (row: Row) => ReactNode;
  emptyState: ReactNode;
  /** Shown when a filter or search hides every row. */
  noResultsLabel?: string;
  pageSize?: number;
  filters?: ReactNode;
  toolbarExtra?: ReactNode;
};

/**
 * Shared table with search, sorting, sticky header, hover actions and paging.
 * Presentation only — callers keep owning the data and the business rules.
 */
export function DataTable<Row>({
  rows, columns, rowKey, searchFields, searchPlaceholder = "Search…", onRowClick,
  rowActions, emptyState, noResultsLabel = "No records match your search.", pageSize = 25,
  filters, toolbarExtra,
}: DataTableProps<Row>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !searchFields) return rows;
    return rows.filter((row) => searchFields(row).toLowerCase().includes(needle));
  }, [rows, query, searchFields]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((item) => item.key === sort.key);
    if (!column?.sortValue) return filtered;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left = column.sortValue!(a);
      const right = column.sortValue!(b);
      if (typeof left === "number" && typeof right === "number") return (left - right) * factor;
      return String(left).localeCompare(String(right), undefined, { numeric: true }) * factor;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  function toggleSort(key: string) {
    setPage(0);
    setSort((prev) =>
      prev?.key === key
        ? prev.dir === "asc" ? { key, dir: "desc" } : null
        : { key, dir: "asc" },
    );
  }

  if (rows.length === 0) return <>{emptyState}</>;

  return (
    <div className="data-table-wrap">
      {searchFields || filters || toolbarExtra ? (
        <div className="table-toolbar">
          {searchFields ? (
            <div className="search-field">
              <span aria-hidden>⌕</span>
              <input
                type="search"
                value={query}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                onChange={(event) => { setQuery(event.target.value); setPage(0); }}
              />
            </div>
          ) : null}
          {filters}
          <div className="table-toolbar-spacer" />
          {toolbarExtra}
          <span className="table-count">{sorted.length} of {rows.length}</span>
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <p className="muted-text table-no-results">{noResultsLabel}</p>
      ) : (
        <div className="table-scroll">
          <table className="smart-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={[
                      column.align === "end" ? "align-end" : "",
                      column.hideOnMobile ? "hide-mobile" : "",
                      column.sortValue ? "sortable" : "",
                    ].filter(Boolean).join(" ")}
                    aria-sort={sort?.key === column.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {column.sortValue ? (
                      <button type="button" className="th-sort" onClick={() => toggleSort(column.key)}>
                        {column.header}
                        <span className="sort-mark" aria-hidden>
                          {sort?.key === column.key ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    ) : column.header}
                  </th>
                ))}
                {rowActions ? <th className="align-end row-actions-head">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={onRowClick ? "clickable-row" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (event) => {
                    if (event.key === "Enter") { event.preventDefault(); onRowClick(row); }
                  } : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={[column.align === "end" ? "align-end" : "", column.hideOnMobile ? "hide-mobile" : ""].filter(Boolean).join(" ")}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                  {rowActions ? (
                    <td className="align-end row-actions-cell" onClick={(event) => event.stopPropagation()}>
                      <div className="row-actions">{rowActions(row)}</div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <div className="table-pager">
          <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <span className="muted-text">Page {currentPage + 1} of {pageCount}</span>
          <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Next</button>
        </div>
      ) : null}
    </div>
  );
}