import { useState } from "react";
import { rowsToSheetData } from "@/lib/sheet";
import { downloadXlsx } from "@/lib/xlsxIo";
import { Database, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

/** Các bảng có thể sao lưu (chỉ đọc bằng quyền quản trị) kèm cột thời gian để lọc khoảng. */
const TABLES = [
  { key: "quizzes", label: "Cuộc thi", timeCol: "created_at" },
  { key: "questions", label: "Câu hỏi", timeCol: "created_at" },
  { key: "units", label: "Đơn vị", timeCol: "created_at" },
  { key: "employees", label: "Nhân sự", timeCol: "created_at" },
  { key: "results", label: "Kết quả", timeCol: "submitted_at" },
  { key: "audit_logs", label: "Nhật ký", timeCol: "created_at" },
] as const;

type TableKey = (typeof TABLES)[number]["key"];

const PAGE = 1000;
/**
 * Trần an toàn cho một lần xuất phía trình duyệt. Vượt ngưỡng này tab sẽ hết bộ nhớ,
 * nên chặn sớm và yêu cầu thu hẹp khoảng thời gian thay vì để trình duyệt treo.
 */
const MAX_ROWS_PER_TABLE = 50_000;

type Range = { from: string; to: string };

function timeColOf(table: TableKey) {
  return TABLES.find((t) => t.key === table)!.timeCol;
}

/** Áp bộ lọc khoảng thời gian (nếu có) lên truy vấn của một bảng. */
function applyRange<T>(query: T, table: TableKey, range: Range): T {
  const col = timeColOf(table);
  let q = query as never as {
    gte: (c: string, v: string) => unknown;
    lte: (c: string, v: string) => unknown;
  };
  if (range.from) q = (q.gte(col, new Date(range.from).toISOString()) as typeof q);
  if (range.to) {
    const end = new Date(range.to);
    end.setHours(23, 59, 59, 999);
    q = q.lte(col, end.toISOString()) as typeof q;
  }
  return q as never as T;
}

/** Đếm trước số dòng để chặn những lần xuất chắc chắn làm treo trình duyệt. */
async function countRows(table: TableKey, range: Range) {
  const { count, error } = await applyRange(
    supabase.from(table).select("*", { count: "exact", head: true }),
    table,
    range,
  );
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

/** Tải dữ liệu một bảng theo từng trang để tránh giới hạn 1000 dòng. */
async function fetchAll(table: TableKey, range: Range) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await applyRange(
      supabase.from(table).select("*").order(timeColOf(table), { ascending: true }),
      table,
      range,
    ).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < PAGE) break;
    if (rows.length >= MAX_ROWS_PER_TABLE) break;
  }
  return rows;
}


function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Xuất bản sao dữ liệu hệ thống ra JSON hoặc Excel để lưu trữ dự phòng. */
export function BackupManager() {
  const [selected, setSelected] = useState<TableKey[]>(TABLES.map((t) => t.key));
  const [busy, setBusy] = useState<"json" | "xlsx" | null>(null);

  const toggle = (key: TableKey) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  const run = async (format: "json" | "xlsx") => {
    if (!selected.length) {
      toast.error("Hãy chọn ít nhất một bảng.");
      return;
    }
    setBusy(format);
    try {
      const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
      const dump: Record<string, Record<string, unknown>[]> = {};
      for (const key of selected) dump[key] = await fetchAll(key);

      if (format === "json") {
        download(
          new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), tables: dump }, null, 2)], {
            type: "application/json",
          }),
          `backup-${stamp}.json`,
        );
      } else {
        await downloadXlsx(
          Object.entries(dump).map(([key, rows]) => ({
            name: key.slice(0, 31),
            data: rowsToSheetData(
              rows.map((r) =>
                Object.fromEntries(
                  Object.entries(r).map(([k, v]) => [
                    k,
                    v === null || v === undefined
                      ? ""
                      : typeof v === "object"
                        ? JSON.stringify(v)
                        : typeof v === "number"
                          ? v
                          : String(v),
                  ]),
                ),
              ),
            ),
          })),
          `backup-${stamp}.xlsx`,
        );
      }
      const totalRows = Object.values(dump).reduce((n, r) => n + r.length, 0);
      toast.success(`Đã xuất ${totalRows.toLocaleString("vi-VN")} dòng dữ liệu.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không xuất được dữ liệu.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <Database className="size-5 text-accent" />
          Sao lưu cơ sở dữ liệu
        </CardTitle>
        <CardDescription>Chọn bảng cần sao lưu rồi tải về tệp JSON (đầy đủ) hoặc Excel (dễ đọc).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-3">
          {TABLES.map((t) => (
            <label
              key={t.key}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <Checkbox checked={selected.includes(t.key)} onCheckedChange={() => toggle(t.key)} />
              {t.label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void run("json")} disabled={busy !== null}>
            {busy === "json" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Tải JSON
          </Button>
          <Button variant="outline" onClick={() => void run("xlsx")} disabled={busy !== null}>
            {busy === "xlsx" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Tải Excel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
