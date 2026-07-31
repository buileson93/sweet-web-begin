import { useState } from "react";
import { Database, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

/** Các bảng có thể sao lưu (chỉ đọc bằng quyền quản trị). */
const TABLES = [
  { key: "quizzes", label: "Cuộc thi" },
  { key: "questions", label: "Câu hỏi" },
  { key: "units", label: "Đơn vị" },
  { key: "employees", label: "Nhân sự" },
  { key: "results", label: "Kết quả" },
  { key: "audit_logs", label: "Nhật ký" },
] as const;

type TableKey = (typeof TABLES)[number]["key"];

const PAGE = 1000;

/** Tải toàn bộ dữ liệu một bảng theo từng trang để tránh giới hạn 1000 dòng. */
async function fetchAll(table: TableKey) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < PAGE) break;
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
        const wb = XLSX.utils.book_new();
        for (const [key, rows] of Object.entries(dump)) {
          const flat = rows.map((r) =>
            Object.fromEntries(
              Object.entries(r).map(([k, v]) => [k, v && typeof v === "object" ? JSON.stringify(v) : v]),
            ),
          );
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flat), key.slice(0, 31));
        }
        XLSX.writeFile(wb, `backup-${stamp}.xlsx`);
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
