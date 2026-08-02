import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Filter, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type DataGridColumn<T> = {
  /** Khoá duy nhất của cột */
  key: string;
  /** Tiêu đề hiển thị */
  header: string;
  /** Giá trị dùng để lọc / sắp xếp / tìm kiếm */
  value: (row: T) => string | number;
  /** Nội dung hiển thị (mặc định dùng value) */
  render?: (row: T) => ReactNode;
  /** Kiểu bộ lọc của cột */
  filter?: "text" | "select" | "none";
  align?: "left" | "right";
  className?: string;
};

type Props<T> = {
  title?: string;
  description?: string;
  data: T[];
  columns: DataGridColumn<T>[];
  pageSize?: number;
  minWidth?: string;
  toolbar?: ReactNode;
  emptyText?: string;
};

const ALL = "__all__";

/**
 * Bảng dữ liệu kiểu Airtable: tìm kiếm nhanh, lọc từng cột, sắp xếp và phân trang.
 */
export function DataGrid<T>({
  title,
  description,
  data,
  columns,
  pageSize = 25,
  minWidth = "48rem",
  toolbar,
  emptyText = "Không có dữ liệu phù hợp.",
}: Props<T>) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const options = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const col of columns) {
      if (col.filter !== "select") continue;
      const set = new Set<string>();
      for (const row of data) set.add(String(col.value(row) ?? ""));
      map[col.key] = [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, "vi"));
    }
    return map;
  }, [columns, data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((row) => {
      if (q) {
        const hit = columns.some((c) => String(c.value(row) ?? "").toLowerCase().includes(q));
        if (!hit) return false;
      }
      for (const col of columns) {
        const f = filters[col.key];
        if (!f || f === ALL) continue;
        const v = String(col.value(row) ?? "").toLowerCase();
        if (col.filter === "select" ? v !== f.toLowerCase() : !v.includes(f.toLowerCase())) return false;
      }
      return true;
    });
  }, [columns, data, filters, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "vi", { numeric: true }) * dir;
    });
  }, [columns, filtered, sortDir, sortKey]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const rows = sorted.slice(current * pageSize, current * pageSize + pageSize);
  const activeFilters = Object.values(filters).filter((v) => v && v !== ALL).length;

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  }

  function setFilter(key: string, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  }

  function clearAll() {
    setFilters({});
    setSearch("");
    setPage(0);
  }

  return (
    <div className="card-elevated overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
        <div className="min-w-0 flex-1">
          {title ? <p className="truncate text-sm font-semibold">{title}</p> : null}
          <p className="type-meta truncate">
            {description ? `${description} · ` : ""}
            {sorted.length}/{data.length} dòng
          </p>
        </div>
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Tìm nhanh..."
            className="h-9 rounded-full pl-8"
          />
        </div>
        <Button
          type="button"
          variant={showFilters || activeFilters ? "default" : "outline"}
          size="sm"
          className="h-9 rounded-full"
          onClick={() => setShowFilters((v) => !v)}
        >
          <Filter className="size-4" /> Lọc{activeFilters ? ` (${activeFilters})` : ""}
        </Button>
        {activeFilters || search ? (
          <Button type="button" variant="ghost" size="sm" className="h-9 rounded-full" onClick={clearAll}>
            <X className="size-4" /> Xoá lọc
          </Button>
        ) : null}
        {toolbar}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead className="sticky top-0 z-10 bg-secondary text-secondary-foreground">
            <tr className="text-left">
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2 font-semibold ${c.align === "right" ? "text-right" : ""}`}>
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className="inline-flex items-center gap-1 hover:opacity-80"
                  >
                    {c.header}
                    {sortKey === c.key ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="size-3" />
                      ) : (
                        <ArrowDown className="size-3" />
                      )
                    ) : (
                      <ChevronsUpDown className="size-3 opacity-40" />
                    )}
                  </button>
                </th>
              ))}
            </tr>
            {showFilters ? (
              <tr className="bg-card">
                {columns.map((c) => (
                  <th key={c.key} className="px-2 pb-2">
                    {c.filter === "none" ? null : c.filter === "select" ? (
                      <Select value={filters[c.key] ?? ALL} onValueChange={(v) => setFilter(c.key, v)}>
                        <SelectTrigger className="h-8 rounded-lg text-xs">
                          <SelectValue placeholder="Tất cả" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>Tất cả</SelectItem>
                          {(options[c.key] ?? []).map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={filters[c.key] ?? ""}
                        onChange={(e) => setFilter(c.key, e.target.value)}
                        placeholder="Lọc..."
                        className="h-8 rounded-lg text-xs"
                      />
                    )}
                  </th>
                ))}
              </tr>
            ) : null}
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-border transition-colors hover:bg-secondary/40">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-2 ${c.align === "right" ? "text-right font-mono" : ""} ${c.className ?? ""}`}
                  >
                    {c.render ? c.render(row) : String(c.value(row) ?? "")}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">
                  {emptyText}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <p className="type-meta">
            Trang {current + 1}/{pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Trước
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
