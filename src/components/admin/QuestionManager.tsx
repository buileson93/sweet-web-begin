import { useQuery, useQueryClient } from "@tanstack/react-query";
import { downloadXlsx } from "@/lib/xlsxIo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileQuestion, Plus, SearchX, Upload } from "lucide-react";
import { toast } from "sonner";

import { AdminSection, EmptyState, ListSkeleton, QueryState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { CsvImportDialog } from "@/components/admin/CsvImportDialog";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { normalizeKey } from "@/lib/csv";
import {
  SOFT_WARN_BYTES,
  extractImageFromClipboard,
  formatBytes,
  uploadQuestionImage,
} from "@/lib/questionImage";
import type { Difficulty } from "@/lib/questionKinds";

import { QuestionFilters } from "./questions/QuestionFilters";
import { QuestionForm } from "./questions/QuestionForm";
import { QuestionList } from "./questions/QuestionList";
import { useQuestionMutations } from "./questions/useQuestionMutations";
import { emptyForm, type CsvQuestion, type QuestionRow } from "./questions/types";

export function QuestionManager({ canEdit = true }: { canEdit?: boolean }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadStage, setUploadStage] = useState<"idle" | "compressing" | "uploading">("idle");
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);
  // Khoá chống trùng: ref cập nhật đồng bộ nên chặn được hai sự kiện liên tiếp.
  const uploadingRef = useRef(false);
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
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title")
        .order("start_time");
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
          "id, quiz_id, question, options, correct_index, correct_indices, accepted_answers, pairs, kind, difficulty, points, order_index, tags, explanation, image_url",
        )
        .eq("quiz_id", quizId)
        // Sắp theo số thứ tự để admin thấy đúng trật tự đề khi tắt xáo trộn.
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
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

  const { save, remove, bulkRemove, bulkDifficulty, importFile } = useQuestionMutations({
    quizId,
    questions,
    selected,
    setSelected,
    form,
    editing,
    onSaved: () => setOpen(false),
  });

  async function exportExcel() {
    const rows = [
      ["Câu hỏi", "Phương án A", "Phương án B", "Phương án C", "Phương án D", "Đáp án"],
      ...questions.map((q) => [
        ...[q.question],
        ...q.options,
        String.fromCharCode(65 + q.correct_index),
      ]),
    ];
    await downloadXlsx([{ name: "CauHoi", data: rows }], "ngan-hang-cau-hoi.xlsx");
  }

  const existingKeys = useMemo(
    () => new Set(questions.map((q) => normalizeKey(q.question))),
    [questions],
  );

  async function importCsv(rows: CsvQuestion[]) {
    const { error } = await supabase
      .from("questions")
      .insert(rows.map((r) => ({ ...r, quiz_id: quizId })));
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
  const attachImage = useCallback(
    async (file: File) => {
      if (!quizId || uploadingRef.current) return;
      uploadingRef.current = true;
      setUploadInfo(null);
      setUploadStage("compressing");
      try {
        const { path, bytes, originalBytes, width, height, mime } = await uploadQuestionImage(
          file,
          quizId,
          setUploadStage,
        );
        setForm((f) => ({ ...f, image_url: path }));
        const label = mime === "image/webp" ? "WebP" : "JPEG";
        const summary = `${formatBytes(originalBytes)} → ${formatBytes(bytes)} (${label}, ${width}×${height})`;
        setUploadInfo(summary);
        toast.success(`Đã tải ảnh lên: ${summary}`);
        if (bytes > SOFT_WARN_BYTES)
          toast.warning(
            `Ảnh sau khi nén vẫn khá nặng (${formatBytes(bytes)}). Bạn vẫn có thể lưu, nhưng nên dùng ảnh đơn giản hơn.`,
          );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Không tải được ảnh.");
      } finally {
        uploadingRef.current = false;
        setUploadStage("idle");
      }
    },
    [quizId],
  );

  // Dán ảnh từ clipboard (Ctrl/Cmd + V): chỉ MỘT nguồn sự thật, nghe trên window
  // và chỉ khi hộp thoại soạn câu hỏi đang mở.
  useEffect(() => {
    if (!open || !canEdit) return;
    function onPaste(e: ClipboardEvent) {
      if (uploadingRef.current) return;
      const file = extractImageFromClipboard(e.clipboardData?.items);
      if (!file) return;
      e.preventDefault();
      void attachImage(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, canEdit, attachImage]);

  // Chặn trình duyệt mở tệp trên tab khi người dùng thả ảnh ra ngoài vùng nhận.
  useEffect(() => {
    if (!open) return;
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, [open]);


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
      order_index: q.order_index ?? 0,
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
          <QuestionFilters
            quizzes={quizzes}
            quizId={quizId}
            onQuizChange={setQuizId}
            difficultyFilter={difficultyFilter}
            onDifficultyChange={setDifficultyFilter}
            keyword={keyword}
            onKeywordChange={setKeyword}
          />
        }
        actions={
          <>
            <CsvImportDialog<CsvQuestion>
              title="Nhập câu hỏi từ CSV"
              description="Cột bắt buộc: cau_hoi, phuong_an_a…d, dap_an (A/B/C/D). Hệ thống kiểm tra định dạng và bỏ qua câu hỏi trùng."
              templateFileName="mau-cau-hoi.csv"
              templateHeaders={[
                "cau_hoi",
                "phuong_an_a",
                "phuong_an_b",
                "phuong_an_c",
                "phuong_an_d",
                "dap_an",
              ]}
              templateSample={[
                ["Sân bay Đà Nẵng có mã ICAO là gì?", "VVDN", "VVNB", "VVTS", "VVCR", "A"],
              ]}
              existingKeys={existingKeys}
              keyOf={(v) => v.question}
              renderPreview={(v) =>
                `${v.question} — Đáp án ${String.fromCharCode(65 + v.correct_index)}`
              }
              disabled={!quizId || !canEdit}
              mapRow={(row) => {
                const question = (row["cau_hoi"] ?? row["question"] ?? "").trim();
                const options = ["a", "b", "c", "d"].map((k) =>
                  (row[`phuong_an_${k}`] ?? row[`option_${k}`] ?? row[k] ?? "").trim(),
                );
                const answer = (row["dap_an"] ?? row["answer"] ?? "").trim().toUpperCase();
                if (question.length < 5)
                  return { ok: false as const, message: "Nội dung câu hỏi quá ngắn." };
                if (options.some((o) => !o))
                  return { ok: false as const, message: "Thiếu phương án trả lời." };
                if (new Set(options.map((o) => o.toLowerCase())).size !== 4)
                  return { ok: false as const, message: "Các phương án bị trùng nhau." };
                let idx = ["A", "B", "C", "D"].indexOf(answer);
                if (idx < 0 && /^[1-4]$/.test(answer)) idx = Number(answer) - 1;
                if (idx < 0)
                  return { ok: false as const, message: "Đáp án phải là A, B, C hoặc D." };
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
            <Button
              variant="outline"
              className="rounded-full"
              onClick={exportExcel}
              disabled={!questions.length}
            >
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
                  <Button
                    className="rounded-full"
                    onClick={openCreate}
                    disabled={!quizId || !canEdit}
                  >
                    <Plus className="size-4" /> Thêm câu hỏi
                  </Button>
                }
              />
            )
          }
        >
          <QuestionList
            paged={paged}
            canEdit={canEdit}
            selected={selected}
            allOnPageSelected={allOnPageSelected}
            onToggleOne={toggleOne}
            onTogglePage={togglePage}
            onClearSelection={() => setSelected(new Set())}
            onBulkDifficulty={(v) => bulkDifficulty.mutate(v)}
            onBulkRemove={() => bulkRemove.mutate()}
            bulkRemoving={bulkRemove.isPending}
            onEdit={openEdit}
            onRemove={(q) => remove.mutate(q)}
            pageSize={PAGE_SIZE}
            page={safePage}
            pageCount={pageCount}
            totalFiltered={filtered.length}
            onPageChange={setPage}
          />
        </QueryState>
      </AdminSection>

      <QuestionForm
        open={open}
        onOpenChange={setOpen}
        editing={Boolean(editing)}
        form={form}
        setForm={setForm}
        uploadStage={uploadStage}
        uploadInfo={uploadInfo}
        onAttachImage={(file) => void attachImage(file)}
        onSave={() => save.mutate()}
        saving={save.isPending}
      />
    </div>
  );
}
