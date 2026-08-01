/**
 * Điểm hành trình và bảng xếp hạng Leo Tháp.
 * Công thức khoá cứng, có kiểm thử:
 *   tầng vượt × 100 + máu còn lại × 2 + số di vật × 15 + bậc lời nguyền × 30
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

/** Xu thưởng cuối hành trình, đã tính hệ số di vật/lời nguyền. */
export function runCoins(score: number, coinPct: number): number {
  return Math.max(0, Math.round((score / 10) * (1 + coinPct)));
}

export type Board = "hang-ngay" | "tu-do";
export const BOARD_LABEL: Record<Board, string> = {
  "hang-ngay": "Hạt hằng ngày",
  "tu-do": "Hạt tự do",
};
