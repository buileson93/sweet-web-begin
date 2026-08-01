import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeKey } from "@/lib/csv";

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
  realDifficulty: "easy" | "medium" | "hard" | "unknown";
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

/** Ngưỡng phân loại độ khó thực tế theo tỉ lệ trả lời đúng. */
export function realDifficultyOf(attempts: number, correctPercent: number): QuestionStats["realDifficulty"] {
  if (attempts < 5) return "unknown";
  if (correctPercent >= 80) return "easy";
  if (correctPercent >= 50) return "medium";
  return "hard";
}

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
