import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { copyImageForQuestion } from "@/lib/questionImages.server";
import { pickByBlueprint, type QuestionRow } from "@/lib/grading";
import { summarizePool, type PoolStats } from "@/lib/quizHealth";
import type { Blueprint, Difficulty, QuestionKind } from "@/lib/questionKinds";
import { QUESTION_COLUMNS } from "@/lib/exam/types";

export type QuizPreviewItem = {
  id: string;
  order: number;
  kind: QuestionKind;
  question: string;
  difficulty: Difficulty;
  tags: string[];
  points: number;
  hasImage: boolean;
};

export type QuizPreview = {
  quizTitle: string;
  questionCount: number;
  poolSize: number;
  items: QuizPreviewItem[];
};

/**
 * Sinh thử một đề theo đúng cấu hình đã lưu — KHÔNG tạo exam_session,
 * KHÔNG trả về đáp án đúng. Chỉ dùng cho ban soạn đề duyệt nội dung.
 */
export async function previewQuizPaper(quizId: string): Promise<QuizPreview> {
  const { data: quiz, error } = await supabaseAdmin
    .from("quizzes")
    .select("title, question_count, blueprint, shuffle_questions")
    .eq("id", quizId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!quiz) throw new Error("Không tìm thấy cuộc thi.");

  const { data: rows, error: poolError } = await supabaseAdmin
    .from("questions")
    .select(QUESTION_COLUMNS)
    .eq("quiz_id", quizId)
    .eq("is_archived", false)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });
  if (poolError) throw new Error(poolError.message);

  const pool = (rows ?? []) as unknown as QuestionRow[];
  const wanted = Math.max(1, quiz.question_count);
  const picked = pool.length
    ? pickByBlueprint(
        pool,
        Math.min(wanted, pool.length),
        (quiz.blueprint ?? {}) as Blueprint,
        quiz.shuffle_questions !== false,
      )
    : [];

  return {
    quizTitle: quiz.title,
    questionCount: wanted,
    poolSize: pool.length,
    items: picked.map((q, i) => ({
      id: q.id,
      order: i + 1,
      kind: q.kind,
      question: q.question,
      difficulty: q.difficulty,
      tags: q.tags ?? [],
      points: q.points || 1,
      hasImage: Boolean(q.image_url),
    })),
  };
}

/** Thống kê kho câu hỏi của một cuộc thi (chỉ tính câu đang dùng). */
export async function quizPoolStats(quizId: string): Promise<PoolStats> {
  const { data, error } = await supabaseAdmin
    .from("questions")
    .select("difficulty, tags")
    .eq("quiz_id", quizId)
    .eq("is_archived", false);
  if (error) throw new Error(error.message);
  return summarizePool((data ?? []) as { difficulty: Difficulty; tags: string[] | null }[]);
}

export type AudienceStats = {
  unitNames: string[];
  audienceCount: number;
  takenCount: number;
  percent: number;
};

/** Số người thuộc đối tượng dự thi và số người đã thi. */
export async function quizAudienceStats(quizId: string): Promise<AudienceStats> {
  const { data: links, error } = await supabaseAdmin
    .from("quiz_audiences")
    .select("unit_id, units(name)")
    .eq("quiz_id", quizId);
  if (error) throw new Error(error.message);

  const unitNames = (links ?? [])
    .map((l) => (l as { units?: { name?: string } | null }).units?.name ?? "")
    .filter(Boolean);

  let employees = supabaseAdmin.from("employees").select("id").eq("is_active", true);
  if (unitNames.length) employees = employees.in("unit_name", unitNames);
  const { data: people, error: peopleError } = await employees;
  if (peopleError) throw new Error(peopleError.message);

  const ids = new Set((people ?? []).map((p) => p.id));
  const { data: results, error: resultError } = await supabaseAdmin
    .from("results")
    .select("employee_id")
    .eq("quiz_id", quizId)
    .eq("disqualified", false);
  if (resultError) throw new Error(resultError.message);

  const taken = new Set(
    (results ?? []).map((r) => r.employee_id).filter((id): id is string => Boolean(id) && ids.has(id!)),
  );

  const audienceCount = ids.size;
  return {
    unitNames,
    audienceCount,
    takenCount: taken.size,
    percent: audienceCount > 0 ? Math.round((taken.size / audienceCount) * 100) : 0,
  };
}

/** Nhân bản cuộc thi (luôn ở trạng thái Nháp), tuỳ chọn sao chép cả ngân hàng câu hỏi kèm ảnh. */
export async function duplicateQuizRow(input: {
  quizId: string;
  copyQuestions: boolean;
}): Promise<{ quizId: string; copiedQuestions: number }> {
  const { data: source, error } = await supabaseAdmin
    .from("quizzes")
    .select("*")
    .eq("id", input.quizId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!source) throw new Error("Không tìm thấy cuộc thi cần nhân bản.");

  const { id: _id, created_at: _c, updated_at: _u, legacy_id: _l, ...rest } = source as Record<string, unknown> & {
    id: string;
  };

  const { data: created, error: insertError } = await supabaseAdmin
    .from("quizzes")
    .insert({
      ...(rest as Record<string, never>),
      title: `${source.title} (bản sao)`,
      status: "draft",
      is_active: false,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);

  const newQuizId = created.id;

  // Sao chép đối tượng dự thi
  const { data: audiences } = await supabaseAdmin
    .from("quiz_audiences")
    .select("unit_id")
    .eq("quiz_id", input.quizId);
  if (audiences?.length) {
    await supabaseAdmin
      .from("quiz_audiences")
      .insert(audiences.map((a) => ({ quiz_id: newQuizId, unit_id: a.unit_id })));
  }

  if (!input.copyQuestions) return { quizId: newQuizId, copiedQuestions: 0 };

  const { data: questions, error: qError } = await supabaseAdmin
    .from("questions")
    .select("*")
    .eq("quiz_id", input.quizId);
  if (qError) throw new Error(qError.message);

  const rows = (questions ?? []).map((q) => {
    const { id: _qid, created_at: _qc, updated_at: _qu, ...body } = q as Record<string, unknown> & { id: string };
    return { ...(body as Record<string, never>), quiz_id: newQuizId, image_url: null };
  });
  if (!rows.length) return { quizId: newQuizId, copiedQuestions: 0 };

  const { data: inserted, error: copyError } = await supabaseAdmin
    .from("questions")
    .insert(rows)
    .select("id, question");
  if (copyError) throw new Error(copyError.message);

  // Ảnh: mỗi bản sao dùng đường dẫn riêng để xoá bản này không mất bản kia.
  const originals = questions ?? [];
  for (let i = 0; i < (inserted ?? []).length; i++) {
    const src = originals[i];
    const dst = inserted![i];
    if (!src?.image_url) continue;
    try {
      const path = await copyImageForQuestion(src.image_url, newQuizId, dst.id);
      await supabaseAdmin.from("questions").update({ image_url: path }).eq("id", dst.id);
    } catch (err) {
      console.error("duplicateQuizRow: copy image", err);
    }
  }

  return { quizId: newQuizId, copiedQuestions: inserted?.length ?? 0 };
}
