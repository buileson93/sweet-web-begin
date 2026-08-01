import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeKey } from "@/lib/csv";
import { realDifficultyOf, type RealDifficulty } from "@/lib/questionInsights";

export { realDifficultyOf };

export type DuplicateHit = {
  id: string;
  quizId: string;
  quizTitle: string;
  question: string;
  archived: boolean;
};

export type QuestionStats = {
  attempts: number;
  correct: number;
  partial: number;
  blank: number;
  /** Tỉ lệ đúng thực tế (0-100). */
  correctPercent: number;
  /** Độ khó suy ra từ dữ liệu thi thật. */
  realDifficulty: RealDifficulty;
};

export type QuestionVersion = {
  id: string;
  version: number;
  createdAt: string;
  question: string;
  options: string[];
  explanation: string;
  difficulty: string;
  points: number;
};

/** Tìm câu hỏi trùng nội dung trên TOÀN hệ thống (mọi cuộc thi), bỏ dấu và không phân biệt hoa thường. */
export async function findGlobalDuplicates(input: {
  question: string;
  excludeId?: string | null;
}): Promise<DuplicateHit[]> {
  const key = normalizeKey(input.question ?? "");
  if (key.length < 8) return [];

  const { data, error } = await supabaseAdmin
    .from("questions")
    .select("id, quiz_id, question, is_archived, quizzes(title)")
    .eq("norm_key" as never, key as never)
    .limit(10);
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as Array<Record<string, unknown>>)
    .filter((row) => row["id"] !== input.excludeId)
    .map((row) => ({
      id: String(row["id"]),
      quizId: String(row["quiz_id"] ?? ""),
      quizTitle: String((row["quizzes"] as { title?: string } | null)?.title ?? "Không rõ"),
      question: String(row["question"] ?? ""),
      archived: Boolean(row["is_archived"]),
    }));
}

/** Thống kê độ khó thực tế + lịch sử phiên bản của một câu hỏi. */
export async function questionInsights(questionId: string): Promise<{
  stats: QuestionStats;
  versions: QuestionVersion[];
}> {
  const [statsRes, versionRes] = await Promise.all([
    supabaseAdmin
      .from("question_stats" as never)
      .select("attempts, correct, partial, blank")
      .eq("question_id" as never, questionId as never)
      .maybeSingle(),
    supabaseAdmin
      .from("question_versions" as never)
      .select("id, version, created_at, snapshot")
      .eq("question_id" as never, questionId as never)
      .order("version", { ascending: false })
      .limit(20),
  ]);

  const raw = (statsRes.data ?? null) as {
    attempts?: number;
    correct?: number;
    partial?: number;
    blank?: number;
  } | null;
  const attempts = Number(raw?.attempts ?? 0);
  const correct = Number(raw?.correct ?? 0);
  const correctPercent = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;

  const versions = ((versionRes.data ?? []) as unknown as Array<Record<string, unknown>>).map(
    (row) => {
      const snap = (row["snapshot"] ?? {}) as Record<string, unknown>;
      return {
        id: String(row["id"]),
        version: Number(row["version"] ?? 1),
        createdAt: String(row["created_at"] ?? ""),
        question: String(snap["question"] ?? ""),
        options: Array.isArray(snap["options"]) ? (snap["options"] as string[]) : [],
        explanation: String(snap["explanation"] ?? ""),
        difficulty: String(snap["difficulty"] ?? ""),
        points: Number(snap["points"] ?? 1),
      };
    },
  );

  return {
    stats: {
      attempts,
      correct,
      partial: Number(raw?.partial ?? 0),
      blank: Number(raw?.blank ?? 0),
      correctPercent,
      realDifficulty: realDifficultyOf(attempts, correctPercent),
    },
    versions,
  };
}

/**
 * Khôi phục câu hỏi về một phiên bản đã lưu trong question_versions.
 * Trigger snapshot_question_version sẽ tự lưu lại bản hiện tại trước khi ghi đè,
 * nên thao tác này luôn có đường lùi.
 */
export async function restoreQuestionVersion(input: {
  questionId: string;
  versionId: string;
}): Promise<{ version: number }> {
  const { data, error } = await supabaseAdmin
    .from("question_versions" as never)
    .select("version, snapshot, question_id")
    .eq("id" as never, input.versionId as never)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as unknown as { version?: number; snapshot?: Record<string, unknown>; question_id?: string } | null;
  if (!row || row.question_id !== input.questionId) throw new Error("Không tìm thấy phiên bản cần khôi phục.");

  const snap = row.snapshot ?? {};
  const pick = <T,>(key: string, fallback: T): T => (snap[key] === undefined || snap[key] === null ? fallback : (snap[key] as T));

  const patch = {
    question: pick("question", ""),
    options: pick<string[]>("options", []),
    correct_index: pick("correct_index", 0),
    correct_indices: pick<number[]>("correct_indices", []),
    accepted_answers: pick<string[]>("accepted_answers", []),
    pairs: pick("pairs", []),
    correct_order: pick<number[]>("correct_order", []),
    explanation: pick("explanation", ""),
    option_explanations: pick<string[]>("option_explanations", []),
    image_url: pick<string | null>("image_url", null),
    difficulty: pick("difficulty", "medium"),
    points: pick("points", 1),
  };

  const { error: upErr } = await supabaseAdmin
    .from("questions")
    .update(patch as never)
    .eq("id", input.questionId);
  if (upErr) throw new Error(upErr.message);

  return { version: Number(row.version ?? 0) };
}
