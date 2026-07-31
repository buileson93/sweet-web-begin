import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { removeQuestionImage } from "@/lib/questionImage";
import { readXlsxSheetData } from "@/lib/xlsxIo";
import type { Difficulty } from "@/lib/questionKinds";

import type { QuestionFormState, QuestionRow } from "./types";

/**
 * Toàn bộ mutation của ngân hàng câu hỏi (lưu, xoá, xoá hàng loạt,
 * đổi độ khó hàng loạt, nhập Excel). Hành vi giữ nguyên như trước khi tách file.
 */
export function useQuestionMutations({
  quizId,
  questions,
  selected,
  setSelected,
  form,
  editing,
  onSaved,
}: {
  quizId: string;
  questions: QuestionRow[];
  selected: Set<string>;
  setSelected: (value: Set<string>) => void;
  form: QuestionFormState;
  editing: QuestionRow | null;
  onSaved: () => void;
}) {
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      const options = form.options
        .map((o) => o.trim())
        .filter((o, i) => o || form.kind === "fill_blank" || i < 2);
      const accepted = form.accepted_answers
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean);
      const pairs = form.pairs
        .map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
        .filter((p) => p.left && p.right);

      if (form.question.trim().length < 5) throw new Error("Nội dung câu hỏi quá ngắn.");
      if (form.kind === "fill_blank" && accepted.length === 0)
        throw new Error("Cần ít nhất một đáp án được chấp nhận.");
      if (form.kind === "matching" && pairs.length < 2)
        throw new Error("Câu nối cặp cần ít nhất 2 cặp.");
      if (["single", "true_false", "multi", "ordering"].includes(form.kind)) {
        if (options.length < 2 || options.some((o) => !o))
          throw new Error("Vui lòng nhập đủ nội dung các phương án.");
      }
      if (form.kind === "multi" && form.correct_indices.length === 0)
        throw new Error("Chọn ít nhất một đáp án đúng.");

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
        order_index: Math.max(0, Number(form.order_index) || 0),
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
      onSaved();
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
      await Promise.all(
        rows.filter((r) => r.image_url).map((r) => removeQuestionImage(r.image_url!)),
      );
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
      const rows = await readXlsxSheetData(await file.arrayBuffer());
      const body = rows.filter((r) => r.length >= 6 && String(r[0]).trim());
      const start = /câu hỏi|question/i.test(String(body[0]?.[0] ?? "")) ? 1 : 0;
      const payload = body.slice(start).map((r) => {
        const answer = String(r[5] ?? "A")
          .trim()
          .toUpperCase();
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

  return { save, remove, bulkRemove, bulkDifficulty, importFile };
}
