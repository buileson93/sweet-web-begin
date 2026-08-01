/** Dựng dòng nhật ký ôn tập từ kết quả chấm — logic thuần, có test. */
export type ReviewLogInput = {
  id: string;
  fraction: number;
  answered: boolean;
  msTaken?: number;
  tags?: string[];
};

export type ReviewLogRow = {
  employee_id: string;
  question_id: string;
  correct: boolean;
  fraction: number;
  ms_taken: number;
  mode: string;
  tags: string[];
};

/** Chế độ sinh ra dữ liệu ôn tập. */
export type ReviewMode = "exam" | "duel" | "practice" | "tower";

export function buildReviewRows(
  employeeId: string | null | undefined,
  mode: ReviewMode,
  items: ReviewLogInput[],
): ReviewLogRow[] {
  if (!employeeId) return [];
  return (items ?? [])
    .filter((it) => Boolean(it?.id))
    .map((it) => ({
      employee_id: employeeId,
      question_id: it.id,
      correct: it.answered && it.fraction >= 1,
      fraction: Math.max(0, Math.min(1, Number.isFinite(it.fraction) ? it.fraction : 0)),
      ms_taken: Math.max(0, Math.round(it.msTaken ?? 0)),
      mode,
      tags: it.tags ?? [],
    }));
}
