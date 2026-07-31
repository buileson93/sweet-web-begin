import { useMemo, useRef, useState } from "react";
import { readXlsxRows } from "@/lib/xlsxIo";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Database, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { EmptyState, PageContainer } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { parseCsv } from "@/lib/csv";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/useMyRoles";

export const Route = createFileRoute("/_authenticated/nhap-du-lieu")({
  head: () => ({
    meta: [
      { title: "Nhập dữ liệu CSV/Excel | Quản trị hội thi" },
      { name: "description", content: "Nhập lại dữ liệu đơn vị, nhân viên, cuộc thi và câu hỏi từ tệp CSV hoặc Excel." },
      { property: "og:title", content: "Nhập dữ liệu CSV/Excel" },
      { property: "og:description", content: "Chọn bảng cần nhập và tải tệp CSV hoặc Excel lên hệ thống." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ImportPage,
});

type Row = Record<string, string>;

const nameKey = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/đ/g, "d")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const num = (v: string, fallback: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : fallback);
const bool = (v: string, fallback = true) =>
  v === "" || v === undefined ? fallback : ["1", "true", "yes", "co", "có", "x"].includes(v.toLowerCase());
const isoDate = (v: string) => {
  const s = v.trim();
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

type TableDef = {
  value: string;
  label: string;
  table: "units" | "employees" | "quizzes" | "questions";
  required: string[];
  headers: string[];
  note: string;
  map: (row: Row) => Record<string, unknown>;
};

const TABLES: TableDef[] = [
  {
    value: "units",
    label: "Đơn vị",
    table: "units",
    required: ["name"],
    headers: ["name", "sort_order"],
    note: "Cột: name (bắt buộc), sort_order.",
    map: (r) => ({ name: r.name, sort_order: num(r.sort_order, 0) }),
  },
  {
    value: "employees",
    label: "Nhân viên",
    table: "employees",
    required: ["full_name"],
    headers: ["full_name", "position", "unit_name", "birth_date", "phone"],
    note: "Cột: full_name (bắt buộc), position, unit_name, birth_date (dd/mm/yyyy), phone.",
    map: (r) => {
      const phone = (r.phone ?? "").replace(/\D/g, "");
      return {
        full_name: r.full_name,
        name_key: nameKey(r.full_name),
        position: r.position || null,
        unit_name: r.unit_name || null,
        birth_date: isoDate(r.birth_date ?? ""),
        phone: phone || null,
        phone_last4: phone ? phone.slice(-4) : null,
        is_active: bool(r.is_active ?? ""),
      };
    },
  },
  {
    value: "quizzes",
    label: "Cuộc thi",
    table: "quizzes",
    required: ["title"],
    headers: ["title", "description", "question_count", "duration_minutes", "is_active"],
    note: "Cột: title (bắt buộc), description, question_count, duration_minutes, is_active.",
    map: (r) => ({
      title: r.title,
      description: r.description ?? "",
      question_count: num(r.question_count, 20),
      duration_minutes: num(r.duration_minutes, 20),
      is_active: bool(r.is_active ?? ""),
    }),
  },
  {
    value: "questions",
    label: "Câu hỏi",
    table: "questions",
    required: ["quiz_id", "question", "option_a", "option_b"],
    headers: ["quiz_id", "question", "option_a", "option_b", "option_c", "option_d", "correct_index", "image_url"],
    note: "Cột: quiz_id, question, option_a…option_d, correct_index (0–3), image_url. correct_index 0 là đáp án A.",
    map: (r) => ({
      quiz_id: r.quiz_id,
      question: r.question,
      options: [r.option_a, r.option_b, r.option_c, r.option_d].filter((o) => (o ?? "").trim() !== ""),
      correct_index: num(r.correct_index, 0),
      image_url: r.image_url || null,
    }),
  },
];

async function readFile(file: File): Promise<Row[]> {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    return (await readXlsxRows(await file.arrayBuffer())) as Row[];
  }
  return parseCsv(await file.text()).rows;
}

function ImportPage() {
  const roles = useMyRoles();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tableValue, setTableValue] = useState<string>("units");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [importing, setImporting] = useState(false);

  const def = useMemo(() => TABLES.find((t) => t.value === tableValue)!, [tableValue]);

  const { valid, issues } = useMemo(() => {
    const valid: Record<string, unknown>[] = [];
    const issues: string[] = [];
    rows.forEach((r, i) => {
      const missing = def.required.filter((c) => !(r[c] ?? "").trim());
      if (missing.length) issues.push(`Dòng ${i + 2}: thiếu ${missing.join(", ")}`);
      else valid.push(def.map(r));
    });
    return { valid, issues };
  }, [rows, def]);

  async function handleImport() {
    if (!valid.length) return;
    setImporting(true);
    try {
      for (let i = 0; i < valid.length; i += 200) {
        const chunk = valid.slice(i, i + 200);
        const { error } = await supabase.from(def.table).insert(chunk as never);
        if (error) throw new Error(error.message);
      }
      toast.success(`Đã nhập ${valid.length} dòng vào bảng ${def.label}.`);
      setRows([]);
      setFileName("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không nhập được dữ liệu.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <PageContainer className="space-y-6 py-8">
          <header className="space-y-1">
            <h1 className="type-h2 flex items-center gap-2">
              <Database className="size-5 text-accent" /> Nhập dữ liệu CSV/Excel
            </h1>
            <p className="type-muted">Chọn bảng cần nhập, tải tệp .csv hoặc .xlsx và kiểm tra trước khi ghi vào hệ thống.</p>
          </header>

          {roles.isLoading ? (
            <Skeleton className="h-64 w-full rounded-2xl" />
          ) : !roles.canEdit ? (
            <EmptyState
              icon={AlertTriangle}
              title="Chỉ quản trị viên mới nhập được dữ liệu"
              description="Tài khoản của bạn chỉ có quyền xem. Liên hệ quản trị viên hệ thống để được cấp quyền."
            />
          ) : (
            <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_1fr] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="table">Bảng cần nhập</Label>
                  <Select
                    value={tableValue}
                    onValueChange={(v) => {
                      setTableValue(v);
                      setRows([]);
                      setFileName("");
                    }}
                  >
                    <SelectTrigger id="table" className="h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TABLES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" className="rounded-full" onClick={() => inputRef.current?.click()}>
                    <Upload className="size-4" /> Chọn tệp CSV/Excel
                  </Button>
                  {fileName ? (
                    <span className="type-meta inline-flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                      <FileSpreadsheet className="size-3.5 shrink-0" /> {fileName} · {rows.length} dòng
                    </span>
                  ) : null}
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const parsed = await readFile(f);
                        setRows(parsed);
                        setFileName(f.name);
                      } catch {
                        toast.error("Không đọc được tệp. Hãy dùng định dạng CSV hoặc Excel.");
                      }
                    }}
                  />
                </div>
              </div>

              <p className="type-meta rounded-xl bg-secondary/50 px-3 py-2 text-muted-foreground">{def.note}</p>

              {rows.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-center sm:max-w-sm">
                    <div className="rounded-2xl border border-border bg-secondary/40 px-3 py-2">
                      <p className="font-mono text-xl font-bold">{valid.length}</p>
                      <p className="type-meta text-muted-foreground">Hợp lệ</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-secondary/40 px-3 py-2">
                      <p className="font-mono text-xl font-bold">{issues.length}</p>
                      <p className="type-meta text-muted-foreground">Cần xem lại</p>
                    </div>
                  </div>

                  {issues.length ? (
                    <ul className="max-h-40 space-y-1 overflow-y-auto rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-muted-foreground">
                      {issues.slice(0, 50).map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="flex items-center gap-2 text-sm text-emerald-600">
                      <CheckCircle2 className="size-4" /> Tất cả các dòng đều hợp lệ.
                    </p>
                  )}

                  <Button
                    className="rounded-full"
                    onClick={() => void handleImport()}
                    disabled={!valid.length || importing}
                  >
                    {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    Nhập {valid.length} dòng vào bảng {def.label}
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </PageContainer>
      </main>
    </div>
  );
}
