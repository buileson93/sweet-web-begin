import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileQuestion, ImagePlus, Loader2, Pencil, Plus, Search, SearchX, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { AdminSection, EmptyState, ListSkeleton, QueryState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CsvImportDialog } from "@/components/admin/CsvImportDialog";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { normalizeKey } from "@/lib/csv";
import { formatBytes, questionImageSrc, removeQuestionImage, uploadQuestionImage } from "@/lib/questionImage";
import { cn } from "@/lib/utils";

import {
  DIFFICULTIES,
  QUESTION_KINDS,
  type Difficulty,
  type QuestionKind,
} from "@/lib/questionKinds";

type Pair = { left: string; right: string };

type QuestionRow = {
  id: string;
  quiz_id: string;
  question: string;
  options: string[];
  correct_index: number;
  correct_indices: number[] | null;
  accepted_answers: string[] | null;
  pairs: Pair[] | null;
  kind: QuestionKind | null;
  difficulty: Difficulty | null;
  points: number | null;
  tags: string[] | null;
  explanation: string | null;
  image_url: string | null;
};

const emptyForm = {
  question: "",
  options: ["", "", "", ""],
  correct_index: 0,
  correct_indices: [] as number[],
  accepted_answers: "",
  pairs: [] as Pair[],
  kind: "single" as QuestionKind,
  difficulty: "medium" as Difficulty,
  points: 1,
  tags: "",
  explanation: "",
  image_url: null as string | null,
};


export function QuestionManager({ canEdit = true }: { canEdit?: boolean }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [quizId, setQuizId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<"all" | Difficulty>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const PAGE_SIZE = 20;


  const { data: quizzes = [] } = useQuery({
    queryKey: ["admin-quizzes-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quizzes").select("id, title").order("start_time");
      if (error) throw error;
      if (data.length && !quizId) setQuizId(data[0].id);
      return data;
    },
  });

  const questionsQuery = useQuery({
    queryKey: ["admin-questions", quizId],
    enabled: Boolean(quizId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select(
          "id, quiz_id, question, options, correct_index, correct_indices, accepted_answers, pairs, kind, difficulty, points, tags, explanation, image_url",
        )
        .eq("quiz_id", quizId)
        .order("created_at");
      if (error) throw error;
      return data as QuestionRow[];
    },
  });
  const questions = questionsQuery.data ?? [];
  const isLoading = questionsQuery.isLoading || (Boolean(quizId) && questionsQuery.isPending);


  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return questions.filter(
      (q) =>
        (!kw || q.question.toLowerCase().includes(kw)) &&
        (difficultyFilter === "all" || (q.difficulty ?? "medium") === difficultyFilter),
    );
  }, [questions, keyword, difficultyFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  // Đổi bộ lọc thì quay lại trang đầu và bỏ chọn.
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [quizId, keyword, difficultyFilter]);

  const allOnPageSelected = paged.length > 0 && paged.every((q) => selected.has(q.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) paged.forEach((q) => next.delete(q.id));
      else paged.forEach((q) => next.add(q.id));
      return next;
    });
  }


  const save = useMutation({
    mutationFn: async () => {
      const options = form.options.map((o) => o.trim()).filter((o, i) => o || form.kind === "fill_blank" || i < 2);
      const accepted = form.accepted_answers
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean);
      const pairs = form.pairs.map((p) => ({ left: p.left.trim(), right: p.right.trim() })).filter((p) => p.left && p.right);

      if (form.question.trim().length < 5) throw new Error("Nội dung câu hỏi quá ngắn.");
      if (form.kind === "fill_blank" && accepted.length === 0) throw new Error("Cần ít nhất một đáp án được chấp nhận.");
      if (form.kind === "matching" && pairs.length < 2) throw new Error("Câu nối cặp cần ít nhất 2 cặp.");
      if (["single", "true_false", "multi", "ordering"].includes(form.kind)) {
        if (options.length < 2 || options.some((o) => !o)) throw new Error("Vui lòng nhập đủ nội dung các phương án.");
      }
      if (form.kind === "multi" && form.correct_indices.length === 0) throw new Error("Chọn ít nhất một đáp án đúng.");

      const payload = {
        quiz_id: quizId,
        question: form.question.trim(),
        options: form.kind === "matching" ? [] : options,
        correct_index: form.kind === "multi" || form.kind === "fill_blank" ? 0 : form.correct_index,
        correct_indices: form.kind === "multi" ? form.correct_indices : [],
        accepted_answers: form.kind === "fill_blank" ? accepted : [],
        pairs: form.kind === "matching" ? pairs : [],
        correct_order: form.kind === "ordering" ? options.map((_, i) => i) : [],
        kind: form.kind,
        difficulty: form.difficulty,
        points: Number(form.points) || 1,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        explanation: form.explanation.trim(),
        image_url: form.image_url,
      };
      const { error } = editing
        ? await supabase.from("questions").update(payload).eq("id", editing.id)
        : await supabase.from("questions").insert(payload);
      if (error) throw error;

      await logAudit({
        action: editing ? "update" : "create",
        entity: "question",
        entityId: editing?.id ?? null,
        entityLabel: payload.question.slice(0, 120),
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Đã cập nhật câu hỏi." : "Đã thêm câu hỏi.");
      setOpen(false);
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (row: QuestionRow) => {
      const { error } = await supabase.from("questions").delete().eq("id", row.id);
      if (error) throw error;
      if (row.image_url) await removeQuestionImage(row.image_url);
      await logAudit({
        action: "delete",
        entity: "question",
        entityId: row.id,
        entityLabel: row.question.slice(0, 120),
      });
    },
    onSuccess: () => {
      toast.success("Đã xoá câu hỏi.");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Xoá hàng loạt các câu hỏi đang được chọn. */
  const bulkRemove = useMutation({
    mutationFn: async () => {
      const ids = [...selected];
      const rows = questions.filter((q) => ids.includes(q.id));
      const { error } = await supabase.from("questions").delete().in("id", ids);
      if (error) throw error;
      await Promise.all(rows.filter((r) => r.image_url).map((r) => removeQuestionImage(r.image_url!)));
      await logAudit({
        action: "delete",
        entity: "question",
        entityLabel: `${ids.length} câu hỏi (hàng loạt)`,
        details: { count: ids.length, quiz_id: quizId },
      });
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`Đã xoá ${n} câu hỏi.`);
      setSelected(new Set());
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Đổi độ khó cho các câu hỏi đang được chọn. */
  const bulkDifficulty = useMutation({
    mutationFn: async (value: Difficulty) => {
      const ids = [...selected];
      const { error } = await supabase.from("questions").update({ difficulty: value }).in("id", ids);
      if (error) throw error;
      await logAudit({
        action: "update",
        entity: "question",
        entityLabel: `Đổi độ khó ${ids.length} câu hỏi`,
        details: { count: ids.length, difficulty: value },
      });
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`Đã cập nhật độ khó cho ${n} câu hỏi.`);
      setSelected(new Set());
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });



  const importFile = useMutation({
    mutationFn: async (file: File) => {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false });
      const body = rows.filter((r) => r.length >= 6 && String(r[0]).trim());
      const start = /câu hỏi|question/i.test(String(body[0]?.[0] ?? "")) ? 1 : 0;
      const payload = body.slice(start).map((r) => {
        const answer = String(r[5] ?? "A").trim().toUpperCase();
        const idx = ["A", "B", "C", "D"].indexOf(answer);
        return {
          quiz_id: quizId,
          question: String(r[0]).trim(),
          options: [1, 2, 3, 4].map((i) => String(r[i] ?? "").trim()),
          correct_index: idx >= 0 ? idx : Math.max(0, Number(answer) - 1) || 0,
        };
      });
      if (!payload.length) throw new Error("Không đọc được dòng hợp lệ nào trong tệp.");
      const { error } = await supabase.from("questions").insert(payload);
      if (error) throw error;
      await logAudit({
        action: "import",
        entity: "question",
        entityLabel: `${payload.length} câu hỏi (Excel)`,
        details: { count: payload.length, quiz_id: quizId },
      });
      return payload.length;
    },
    onSuccess: (n) => {
      toast.success(`Đã nhập ${n} câu hỏi.`);
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const rows = [
      ["Câu hỏi", "Phương án A", "Phương án B", "Phương án C", "Phương án D", "Đáp án"],
      ...questions.map((q) => [...[q.question], ...q.options, String.fromCharCode(65 + q.correct_index)]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CauHoi");
    XLSX.writeFile(wb, "ngan-hang-cau-hoi.xlsx");
  }

  const existingKeys = useMemo(() => new Set(questions.map((q) => normalizeKey(q.question))), [questions]);

  type CsvQuestion = { question: string; options: string[]; correct_index: number };

  async function importCsv(rows: CsvQuestion[]) {
    const { error } = await supabase.from("questions").insert(rows.map((r) => ({ ...r, quiz_id: quizId })));
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      action: "import",
      entity: "question",
      entityLabel: `${rows.length} câu hỏi (CSV)`,
      details: { count: rows.length, quiz_id: quizId },
    });
    toast.success(`Đã nhập ${rows.length} câu hỏi.`);
    void qc.invalidateQueries({ queryKey: ["admin-questions", quizId] });
  }

  /** Tải ảnh lên kho lưu trữ và gán vào câu hỏi đang soạn. */
  async function attachImage(file: File) {
    if (!quizId) return;
    setUploading(true);
    try {
      const { path, bytes } = await uploadQuestionImage(file, quizId);
      setForm((f) => ({ ...f, image_url: path }));
      toast.success(`Đã tải ảnh lên (${formatBytes(bytes)} sau khi nén).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tải được ảnh.");
    } finally {
      setUploading(false);
    }
  }

  // Dán ảnh từ clipboard (Ctrl/Cmd + V) khi đang mở hộp thoại soạn câu hỏi.
  useEffect(() => {
    if (!open || !canEdit) return;
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (!file) return;
      e.preventDefault();
      void attachImage(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, canEdit, quizId]);


  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, options: ["", "", "", ""], pairs: [], correct_indices: [] });
    setOpen(true);
  }

  function openEdit(q: QuestionRow) {
    setEditing(q);
    setForm({
      question: q.question,
      options: q.options.length ? [...q.options] : ["", "", "", ""],
      correct_index: q.correct_index,
      correct_indices: q.correct_indices ?? [],
      accepted_answers: (q.accepted_answers ?? []).join("\n"),
      pairs: Array.isArray(q.pairs) ? q.pairs : [],
      kind: q.kind ?? "single",
      difficulty: q.difficulty ?? "medium",
      points: q.points ?? 1,
      tags: (q.tags ?? []).join(", "),
      explanation: q.explanation ?? "",
      image_url: q.image_url,
    });
    setOpen(true);
  }


  return (
    <div className="space-y-4">

      <AdminSection
        title="Ngân hàng câu hỏi"
        description={isLoading ? "Đang tải..." : `${filtered.length} / ${questions.length} câu hỏi`}
        toolbar={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={quizId} onValueChange={setQuizId}>
              <SelectTrigger className="rounded-full sm:w-56">
                <SelectValue placeholder="Chọn cuộc thi" />
              </SelectTrigger>
              <SelectContent>
                {quizzes.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={difficultyFilter}
              onValueChange={(v) => setDifficultyFilter(v as "all" | Difficulty)}
            >
              <SelectTrigger className="rounded-full sm:w-40">
                <SelectValue placeholder="Độ khó" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mọi độ khó</SelectItem>
                {DIFFICULTIES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative sm:w-56">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="rounded-full pl-10"
                placeholder="Tìm câu hỏi..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          </div>
        }
        actions={
          <>
            <CsvImportDialog<CsvQuestion>
              title="Nhập câu hỏi từ CSV"
              description="Cột bắt buộc: cau_hoi, phuong_an_a…d, dap_an (A/B/C/D). Hệ thống kiểm tra định dạng và bỏ qua câu hỏi trùng."
              templateFileName="mau-cau-hoi.csv"
              templateHeaders={["cau_hoi", "phuong_an_a", "phuong_an_b", "phuong_an_c", "phuong_an_d", "dap_an"]}
              templateSample={[["Sân bay Đà Nẵng có mã ICAO là gì?", "VVDN", "VVNB", "VVTS", "VVCR", "A"]]}
              existingKeys={existingKeys}
              keyOf={(v) => v.question}
              renderPreview={(v) => `${v.question} — Đáp án ${String.fromCharCode(65 + v.correct_index)}`}
              disabled={!quizId || !canEdit}
              mapRow={(row) => {
                const question = (row["cau_hoi"] ?? row["question"] ?? "").trim();
                const options = ["a", "b", "c", "d"].map((k) =>
                  (row[`phuong_an_${k}`] ?? row[`option_${k}`] ?? row[k] ?? "").trim(),
                );
                const answer = (row["dap_an"] ?? row["answer"] ?? "").trim().toUpperCase();
                if (question.length < 5) return { ok: false as const, message: "Nội dung câu hỏi quá ngắn." };
                if (options.some((o) => !o)) return { ok: false as const, message: "Thiếu phương án trả lời." };
                if (new Set(options.map((o) => o.toLowerCase())).size !== 4)
                  return { ok: false as const, message: "Các phương án bị trùng nhau." };
                let idx = ["A", "B", "C", "D"].indexOf(answer);
                if (idx < 0 && /^[1-4]$/.test(answer)) idx = Number(answer) - 1;
                if (idx < 0) return { ok: false as const, message: "Đáp án phải là A, B, C hoặc D." };
                return { ok: true as const, value: { question, options, correct_index: idx } };
              }}
              onImport={importCsv}
            />
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFile.mutate(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => fileRef.current?.click()}
              disabled={!quizId || importFile.isPending || !canEdit}
            >
              <Upload className="size-4" /> Nhập Excel
            </Button>
            <Button variant="outline" className="rounded-full" onClick={exportExcel} disabled={!questions.length}>
              <Download className="size-4" /> Xuất
            </Button>
            <Button className="rounded-full" onClick={openCreate} disabled={!quizId || !canEdit}>
              <Plus className="size-4" /> Thêm
            </Button>
          </>
        }
      >
        <QueryState
          isLoading={isLoading}
          isError={questionsQuery.isError}
          error={questionsQuery.error}
          isFetching={questionsQuery.isFetching}
          onRetry={() => void questionsQuery.refetch()}
          isEmpty={filtered.length === 0}
          skeleton={<ListSkeleton rows={4} height="h-32" />}
          empty={
            keyword.trim() ? (
              <EmptyState
                icon={SearchX}
                title="Không tìm thấy câu hỏi phù hợp"
                description="Thử từ khoá khác hoặc xoá bộ lọc tìm kiếm."
                action={
                  <Button variant="outline" className="rounded-full" onClick={() => setKeyword("")}>
                    Xoá tìm kiếm
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={FileQuestion}
                title="Ngân hàng câu hỏi đang trống"
                description="Thêm thủ công từng câu hoặc nhập hàng loạt từ tệp Excel."
                action={
                  <Button className="rounded-full" onClick={openCreate} disabled={!quizId || !canEdit}>
                    <Plus className="size-4" /> Thêm câu hỏi
                  </Button>
                }
              />
            )
          }
        >
          <div className="space-y-3">
            {filtered.map((q, idx) => (
              <div key={q.id} className="card-elevated p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold leading-relaxed">
                    {idx + 1}. {q.question}
                  </p>
                  <div className={cn("flex shrink-0 gap-1", !canEdit && "hidden")}>
                    <Button size="icon" variant="ghost" aria-label="Sửa" onClick={() => openEdit(q)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Xoá"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        if (confirm("Xoá câu hỏi này?")) remove.mutate(q);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                {questionImageSrc(q.image_url) ? (
                  <img
                    src={questionImageSrc(q.image_url)!}
                    alt={`Ảnh minh hoạ câu ${idx + 1}`}
                    loading="lazy"
                    className="mt-3 max-h-40 rounded-xl border border-border object-contain"
                  />
                ) : null}
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {q.options.map((o, i) => (
                    <li
                      key={i}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm",
                        i === q.correct_index
                          ? "border-success/50 bg-success/10 text-success"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      <span className="font-semibold">{String.fromCharCode(65 + i)}. </span>
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </QueryState>
      </AdminSection>



      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa câu hỏi" : "Thêm câu hỏi"}</DialogTitle>
            <DialogDescription>Chọn phương án đúng bằng nút bên trái.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nội dung câu hỏi</Label>
              <Textarea
                rows={3}
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Ảnh minh hoạ (không bắt buộc)</Label>
              {questionImageSrc(form.image_url) ? (
                <div className="relative w-fit">
                  <img
                    src={questionImageSrc(form.image_url)!}
                    alt="Ảnh minh hoạ câu hỏi"
                    className="max-h-48 rounded-xl border border-border object-contain"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    aria-label="Gỡ ảnh"
                    className="absolute -right-2 -top-2 size-7 rounded-full"
                    onClick={() => setForm((f) => ({ ...f, image_url: null }))}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <div
                  onPaste={(e) => {
                    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
                    const file = item?.getAsFile();
                    if (!file) return;
                    e.preventDefault();
                    void attachImage(file);
                  }}
                  className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-border p-4"
                >
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={uploading}
                    onClick={() => imageRef.current?.click()}
                  >
                    {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                    {uploading ? "Đang nén và tải lên..." : "Chọn ảnh"}
                  </Button>
                  <p className="type-meta">
                    Hoặc <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">Ctrl/⌘ + V</kbd> để
                    dán ảnh chụp màn hình trực tiếp từ clipboard.
                  </p>
                </div>
              )}
              <p className="type-meta">Ảnh được tự động nén về WebP, cạnh dài tối đa 1280px để tiết kiệm dung lượng.</p>
              <input
                ref={imageRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void attachImage(file);
                }}
              />

            </div>
            {/* Thuộc tính câu hỏi */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Loại câu hỏi</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) => {
                    const kind = v as QuestionKind;
                    setForm((f) => ({
                      ...f,
                      kind,
                      options:
                        kind === "true_false"
                          ? ["Đúng", "Sai"]
                          : f.options.length >= 2
                            ? f.options
                            : ["", "", "", ""],
                      correct_index: 0,
                      correct_indices: [],
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUESTION_KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Độ khó</Label>
                <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v as Difficulty })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Điểm</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.points}
                  onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
                />
              </div>
            </div>

            <p className="type-meta">{QUESTION_KINDS.find((k) => k.value === form.kind)?.hint}</p>

            {/* Đáp án theo từng loại */}
            {form.kind === "fill_blank" ? (
              <div className="space-y-2">
                <Label>Các đáp án được chấp nhận (mỗi dòng một đáp án)</Label>
                <Textarea
                  rows={3}
                  value={form.accepted_answers}
                  onChange={(e) => setForm({ ...form, accepted_answers: e.target.value })}
                  placeholder={"Hà Nội\nHa Noi"}
                />
              </div>
            ) : form.kind === "matching" ? (
              <div className="space-y-2">
                <Label>Các cặp cần nối</Label>
                {form.pairs.map((p, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                    <Input
                      value={p.left}
                      placeholder="Vế trái"
                      onChange={(e) => {
                        const next = [...form.pairs];
                        next[i] = { ...next[i], left: e.target.value };
                        setForm({ ...form, pairs: next });
                      }}
                    />
                    <Input
                      value={p.right}
                      placeholder="Vế phải"
                      onChange={(e) => {
                        const next = [...form.pairs];
                        next[i] = { ...next[i], right: e.target.value };
                        setForm({ ...form, pairs: next });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Xoá cặp"
                      onClick={() => setForm({ ...form, pairs: form.pairs.filter((_, j) => j !== i) })}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setForm({ ...form, pairs: [...form.pairs, { left: "", right: "" }] })}
                >
                  <Plus className="size-4" /> Thêm cặp
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>
                  {form.kind === "ordering" ? "Các mục theo đúng thứ tự" : "Phương án trả lời"}
                </Label>
                {form.options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {form.kind === "ordering" ? (
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-sm font-bold">
                        {i + 1}
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Đánh dấu phương án ${String.fromCharCode(65 + i)} là đúng`}
                        onClick={() =>
                          setForm((f) =>
                            f.kind === "multi"
                              ? {
                                  ...f,
                                  correct_indices: f.correct_indices.includes(i)
                                    ? f.correct_indices.filter((x) => x !== i)
                                    : [...f.correct_indices, i].sort((a, b) => a - b),
                                }
                              : { ...f, correct_index: i },
                          )
                        }
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold transition-colors",
                          (form.kind === "multi" ? form.correct_indices.includes(i) : form.correct_index === i)
                            ? "border-success bg-success text-success-foreground"
                            : "border-border bg-secondary text-muted-foreground",
                        )}
                      >
                        {String.fromCharCode(65 + i)}
                      </button>
                    )}
                    <Input
                      value={o}
                      placeholder={form.kind === "ordering" ? `Mục ${i + 1}` : `Phương án ${String.fromCharCode(65 + i)}`}
                      onChange={(e) => {
                        const next = [...form.options];
                        next[i] = e.target.value;
                        setForm({ ...form, options: next });
                      }}
                    />
                    {form.options.length > 2 ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Xoá phương án"
                        onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })}
                      >
                        <X className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                ))}
                {form.kind !== "true_false" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setForm({ ...form, options: [...form.options, ""] })}
                  >
                    <Plus className="size-4" /> Thêm phương án
                  </Button>
                ) : null}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Thẻ chủ đề (cách nhau bằng dấu phẩy)</Label>
                <Input
                  value={form.tags}
                  placeholder="an toàn bay, khí tượng"
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Giải thích đáp án (hiện khi xem lại)</Label>
                <Textarea rows={2} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
