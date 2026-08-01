export type RealDifficulty = "easy" | "medium" | "hard" | "unknown";

/** Ngưỡng phân loại độ khó thực tế theo tỉ lệ trả lời đúng (cần tối thiểu 5 lượt làm). */
export function realDifficultyOf(attempts: number, correctPercent: number): RealDifficulty {
  if (attempts < 5) return "unknown";
  if (correctPercent >= 80) return "easy";
  if (correctPercent >= 50) return "medium";
  return "hard";
}

export type QualityFlag = {
  code: "too_easy" | "suspect_answer" | "high_blank";
  label: string;
  hint: string;
  tone: "warning" | "danger";
};

/**
 * Gắn cờ chất lượng câu hỏi dựa trên số liệu thi thật (question_stats),
 * giúp ngân hàng đề tự cải thiện sau mỗi kỳ thi thay vì chỉ kiểm tra cấu hình tĩnh.
 * Cần tối thiểu 20 lượt làm để số liệu đủ tin cậy.
 */
export const QUALITY_MIN_ATTEMPTS = 20;

export function questionQualityFlags(stats: {
  attempts: number;
  correct: number;
  blank: number;
}): QualityFlag[] {
  const attempts = Math.max(0, Math.round(stats.attempts));
  if (attempts < QUALITY_MIN_ATTEMPTS) return [];

  const correctPercent = (stats.correct / attempts) * 100;
  const blankPercent = (stats.blank / attempts) * 100;
  const flags: QualityFlag[] = [];

  if (correctPercent > 95) {
    flags.push({
      code: "too_easy",
      label: "Quá dễ",
      hint: `${Math.round(correctPercent)}% trả lời đúng — câu này gần như không phân loại được thí sinh.`,
      tone: "warning",
    });
  }
  if (correctPercent < 15) {
    flags.push({
      code: "suspect_answer",
      label: "Nghi sai đáp án",
      hint: `Chỉ ${Math.round(correctPercent)}% trả lời đúng — nên soát lại đáp án hoặc cách diễn đạt.`,
      tone: "danger",
    });
  }
  if (blankPercent >= 30) {
    flags.push({
      code: "high_blank",
      label: "Nhiều người bỏ trống",
      hint: `${Math.round(blankPercent)}% bỏ trống — câu có thể tối nghĩa hoặc thiếu dữ kiện.`,
      tone: "warning",
    });
  }
  return flags;
}
