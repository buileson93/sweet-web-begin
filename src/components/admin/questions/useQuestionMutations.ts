import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { isTempImagePath, removeQuestionImage } from "@/lib/questionImage";
import {
  commitOptionImages,
  commitQuestionImage,
  duplicateOptionImages,
  duplicateQuestionImage,
  relocateQuestionImages,
} from "@/lib/questionImages.functions";
import {
  firstErrorMessage,
  hasBlockingErrors,
  parseAcceptedAnswers,
  parseTimeLimit,
  trimmedOptions,
  validateQuestionDraft,
} from "@/lib/questionValidation";
import { readXlsxSheetData } from "@/lib/xlsxIo";
import type { Difficulty } from "@/lib/questionKinds";

import type { QuestionFormState, QuestionRow } from "./types";

/** Toàn bộ mutation của ngân hàng câu hỏi. */
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
  const ids = () => [...selected];

  const save = useMutation({
    mutationFn: async () => {
      const result = validateQuestionDraft(
        form,
        questions.map((q) => ({ id: q.id, question: q.question })),
        editing?.id ?? null,
      );
      if (hasBlockingErrors(result))
        throw new Error(firstErrorMessage(result) ?? "Biểu mẫu chưa hợp lệ.");

      const options = trimmedOptions(form.options).filter(
        (o, i) => o || form.kind === "fill_blank" || i < 2,
      );
      const accepted = parseAcceptedAnswers(form.accepted_answers);
      const pairs = form.pairs
        .map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
        .filter((p) => p.left && p.right);

      const optionImages = form.option_images
        .slice(0, options.length)
        .map((img, i) => (options[i] ? img : ""));
      const payload = {
        quiz_id: quizId,
        question: form.question.trim(),
        options: form.kind === "matching" ? [] : options,
        option_images: form.kind === "matching" ? [] : optionImages,
        correct_index: form.kind === "multi" || form.kind === "fill_blank" ? 0 : form.correct_index,
        correct_indices: form.kind === "multi" ? form.correct_indices : [],
        accepted_answers: form.kind === "fill_blank" ? accepted : [],
        pairs: form.kind === "matching" ? pairs : [],
        correct_order: form.kind === "ordering" ? options.map((_, i) => i) : [],
        kind: form.kind,
        difficulty: form.difficulty,
        points: Number(form.points) || 1,
        order_index: Math.max(0, Number(form.order_index) || 0),
        time_limit_seconds: parseTimeLimit(form.time_limit_seconds),
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        explanation: form.explanation.trim(),
        image_url: form.image_url,
      };
      let questionId = editing?.id ?? "";
      if (editing) {
        const { error } = await supabase.from("questions").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("questions")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        questionId = data.id;
      }

      // Chuyển ảnh minh hoạ và ảnh phương án từ tmp sang thư mục chính thức
      if (payload.image_url && isTempImagePath(payload.image_url) && questionId) {
        try {
          await commitQuestionImage({ data: { path: payload.image_url, quizId, questionId } });
        } catch {
          toast.warning("Đã lưu câu hỏi nhưng chưa chuyển được ảnh minh hoạ vào kho chính thức.");
        }
      }
      if ((payload.option_images ?? []).some((p) => p && isTempImagePath(p)) && questionId) {
        try {
          await commitOptionImages({
            data: { paths: payload.option_images ?? [], quizId, questionId },
          });
        } catch {
          toast.warning("Chưa chuyển được một số ảnh phương án vào kho chính thức.");
        }
      }

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
      for (const imgPath of row.option_images ?? [])
        if (imgPath) await removeQuestionImage(imgPath);
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

  /** Đưa vào / lấy ra khỏi lưu trữ (thay cho xoá vĩnh viễn). */
  const archive = useMutation({
    mutationFn: async ({ row, archived }: { row: QuestionRow; archived: boolean }) => {
      const { error } = await supabase
        .from("questions")
        .update({ is_archived: archived })
        .eq("id", row.id);
      if (error) throw error;
      await logAudit({
        action: "update",
        entity: "question",
        entityId: row.id,
        entityLabel: `${archived ? "Lưu trữ" : "Khôi phục"}: ${row.question.slice(0, 100)}`,
      });
      return archived;
    },
    onSuccess: (archived) => {
      toast.success(archived ? "Đã đưa vào lưu trữ." : "Đã đưa trở lại sử dụng.");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Nhân bản câu hỏi, kể cả ảnh (ảnh được copy sang đường dẫn riêng). */
  const duplicate = useMutation({
    mutationFn: async (row: QuestionRow) => {
      const { data, error } = await supabase
        .from("questions")
        .insert({
          quiz_id: row.quiz_id,
          question: `${row.question} (bản sao)`,
          options: row.options,
          correct_index: row.correct_index,
          correct_indices: row.correct_indices ?? [],
          accepted_answers: row.accepted_answers ?? [],
          pairs: row.pairs ?? [],
          kind: row.kind ?? "single",
          difficulty: row.difficulty ?? "medium",
          points: row.points ?? 1,
          order_index: (row.order_index ?? 0) + 1,
          time_limit_seconds: row.time_limit_seconds,
          tags: row.tags ?? [],
          explanation: row.explanation ?? "",
          is_archived: row.is_archived ?? false,
          image_url: null,
          option_images: [],
        })
        .select("id")
        .single();
      if (error) throw error;
      if (row.image_url) {
        try {
          await duplicateQuestionImage({
            data: { path: row.image_url, quizId: row.quiz_id, questionId: data.id },
          });
        } catch {
          toast.warning("Đã tạo bản sao nhưng chưa nhân bản được ảnh minh hoạ.");
        }
      }
      await logAudit({
        action: "create",
        entity: "question",
        entityId: data.id,
        entityLabel: `Bản sao: ${row.question.slice(0, 100)}`,
      });
    },
    onSuccess: () => {
      toast.success("Đã tạo bản sao câu hỏi.");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Cập nhật số thứ tự theo lô (dùng cho nút Lên/Xuống và ô nhập số). */
  const reorder = useMutation({
    mutationFn: async (updates: { id: string; order_index: number }[]) => {
      for (const u of updates) {
        const { error } = await supabase
          .from("questions")
          .update({ order_index: u.order_index })
          .eq("id", u.id);
        if (error) throw error;
      }
      return updates.length;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-questions"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  /** Xoá hàng loạt các câu hỏi đang được chọn. */
  const bulkRemove = useMutation({
    mutationFn: async () => {
      const list = ids();
      const rows = questions.filter((q) => list.includes(q.id));
      const { error } = await supabase.from("questions").delete().in("id", list);
      if (error) throw error;
      await Promise.all(
        rows.filter((r) => r.image_url).map((r) => removeQuestionImage(r.image_url!)),
      );
      await logAudit({
        action: "delete",
        entity: "question",
        entityLabel: `${list.length} câu hỏi (hàng loạt)`,
        details: { count: list.length, quiz_id: quizId },
      });
      return list.length;
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
      const list = ids();
      const { error } = await supabase
        .from("questions")
        .update({ difficulty: value })
        .in("id", list);
      if (error) throw error;
      await logAudit({
        action: "update",
        entity: "question",
        entityLabel: `Đổi độ khó ${list.length} câu hỏi`,
        details: { count: list.length, difficulty: value },
      });
      return list.length;
    },
    onSuccess: (n) => {
      toast.success(`Đã cập nhật độ khó cho ${n} câu hỏi.`);
      setSelected(new Set());
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Đổi điểm cho các câu hỏi đang được chọn. */
  const bulkPoints = useMutation({
    mutationFn: async (value: number) => {
      const points = Math.max(1, Math.round(Number(value) || 1));
      const list = ids();
      const { error } = await supabase.from("questions").update({ points }).in("id", list);
      if (error) throw error;
      await logAudit({
        action: "update",
        entity: "question",
        entityLabel: `Đổi điểm ${list.length} câu hỏi`,
        details: { count: list.length, points },
      });
      return list.length;
    },
    onSuccess: (n) => {
      toast.success(`Đã đổi điểm cho ${n} câu hỏi.`);
      setSelected(new Set());
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Gán thẻ chủ đề cho các câu hỏi đang được chọn. */
  const bulkTags = useMutation({
    mutationFn: async ({ tags, mode }: { tags: string; mode: "add" | "replace" }) => {
      const parsed = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const list = ids();
      for (const id of list) {
        const current = questions.find((q) => q.id === id)?.tags ?? [];
        const next = mode === "replace" ? parsed : [...new Set([...current, ...parsed])];
        const { error } = await supabase.from("questions").update({ tags: next }).eq("id", id);
        if (error) throw error;
      }
      await logAudit({
        action: "update",
        entity: "question",
        entityLabel: `Gán thẻ cho ${list.length} câu hỏi`,
        details: { count: list.length, tags: parsed, mode },
      });
      return list.length;
    },
    onSuccess: (n) => {
      toast.success(`Đã cập nhật thẻ cho ${n} câu hỏi.`);
      setSelected(new Set());
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Lưu trữ / khôi phục hàng loạt. */
  const bulkArchive = useMutation({
    mutationFn: async (archived: boolean) => {
      const list = ids();
      const { error } = await supabase
        .from("questions")
        .update({ is_archived: archived })
        .in("id", list);
      if (error) throw error;
      await logAudit({
        action: "update",
        entity: "question",
        entityLabel: `${archived ? "Lưu trữ" : "Khôi phục"} ${list.length} câu hỏi`,
        details: { count: list.length, is_archived: archived },
      });
      return { n: list.length, archived };
    },
    onSuccess: ({ n, archived }) => {
      toast.success(`Đã ${archived ? "lưu trữ" : "khôi phục"} ${n} câu hỏi.`);
      setSelected(new Set());
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Chuyển các câu hỏi đang chọn sang cuộc thi khác (kèm di chuyển ảnh). */
  const bulkMoveQuiz = useMutation({
    mutationFn: async (targetQuizId: string) => {
      const list = ids();
      const { error } = await supabase
        .from("questions")
        .update({ quiz_id: targetQuizId })
        .in("id", list);
      if (error) throw error;
      const withImages = questions.filter((q) => list.includes(q.id) && q.image_url).map((q) => q.id);
      if (withImages.length) {
        try {
          await relocateQuestionImages({ data: { questionIds: withImages, quizId: targetQuizId } });
        } catch {
          toast.warning("Đã chuyển câu hỏi nhưng chưa di chuyển được toàn bộ ảnh.");
        }
      }
      await logAudit({
        action: "update",
        entity: "question",
        entityLabel: `Chuyển ${list.length} câu hỏi sang cuộc thi khác`,
        details: { count: list.length, from: quizId, to: targetQuizId },
      });
      return list.length;
    },
    onSuccess: (n) => {
      toast.success(`Đã chuyển ${n} câu hỏi sang cuộc thi mới.`);
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

  return {
    save,
    remove,
    archive,
    duplicate,
    reorder,
    bulkRemove,
    bulkDifficulty,
    bulkPoints,
    bulkTags,
    bulkArchive,
    bulkMoveQuiz,
    importFile,
  };
}
