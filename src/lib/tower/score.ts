/**
 * Điểm hành trình và bảng xếp hạng Leo Tháp.
 * Công thức khoá cứng, có kiểm thử:
 *   tầng vượt × 100 + an toàn còn lại × 2 + số trang bị × 15 + bậc yếu tố bất lợi × 30
 */
import { curseRank } from "@/lib/tower/curses";

export type RunScoreInput = {
  floorsCleared: number;
  hp: number;
  relics: string[];
  curses: string[];
  /** Độ thăng thiên: mỗi cấp cộng 5% điểm. */
  ascension?: number;
};

export function runScore(input: RunScoreInput): number {
  const base =
    Math.max(0, input.floorsCleared) * 100 +
    Math.max(0, input.hp) * 2 +
    input.relics.length * 15 +
    curseRank(input.curses) * 30;
  const asc = 1 + Math.max(0, input.ascension ?? 0) * 0.05;
  return Math.round(base * asc);
}

/** Tín chỉ thưởng cuối hành trình, đã tính hệ số trang bị/yếu tố bất lợi. */
export function runCoins(score: number, coinPct: number): number {
  return Math.max(0, Math.round((score / 10) * (1 + coinPct)));
}

export type Board = "hang-ngay" | "tu-do";
export const BOARD_LABEL: Record<Board, string> = {
  "hang-ngay": "Hạt hằng ngày",
  "tu-do": "Hạt tự do",
};

export type ScorePart = { key: string; label: string; value: number; hint: string };

/**
 * Bóc tách nguồn gốc điểm của một hành trình để người chơi biết điểm từ đâu ra.
 * Tổng các phần (đã nhân hệ số thăng thiên) luôn bằng `runScore`.
 */
export function scoreBreakdown(input: RunScoreInput): { parts: ScorePart[]; total: number } {
  const mult = 1 + Math.max(0, input.ascension ?? 0) * 0.05;
  const raw: ScorePart[] = [
    { key: "floors", label: "Tầng đã vượt", value: Math.max(0, input.floorsCleared) * 100, hint: "100 điểm mỗi tầng" },
    { key: "hp", label: "An toàn còn lại", value: Math.max(0, input.hp) * 2, hint: "2 điểm mỗi an toàn" },
    { key: "relics", label: "Trang bị mang theo", value: input.relics.length * 15, hint: "15 điểm mỗi trang bị" },
    { key: "curses", label: "Yếu tố bất lợi gánh chịu", value: curseRank(input.curses) * 30, hint: "30 điểm mỗi bậc" },
  ];
  const total = runScore(input);
  const scaled = raw.map((p) => ({ ...p, value: Math.round(p.value * mult) }));
  // Dồn sai số làm tròn vào phần lớn nhất để tổng luôn khớp điểm chính thức.
  const diff = total - scaled.reduce((s, p) => s + p.value, 0);
  if (diff !== 0 && scaled.length) {
    const idx = scaled.reduce((best, p, i) => (p.value > (scaled[best]?.value ?? 0) ? i : best), 0);
    scaled[idx] = { ...scaled[idx]!, value: scaled[idx]!.value + diff };
  }
  return { parts: scaled, total };
}
