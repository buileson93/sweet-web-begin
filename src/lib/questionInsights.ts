export type RealDifficulty = "easy" | "medium" | "hard" | "unknown";

/** Ngưỡng phân loại độ khó thực tế theo tỉ lệ trả lời đúng (cần tối thiểu 5 lượt làm). */
export function realDifficultyOf(attempts: number, correctPercent: number): RealDifficulty {
  if (attempts < 5) return "unknown";
  if (correctPercent >= 80) return "easy";
  if (correctPercent >= 50) return "medium";
  return "hard";
}
