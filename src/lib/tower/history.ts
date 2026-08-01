/**
 * Lịch sử hành trình Leo Tháp — lưu ngay tại máy để chơi và xem lại được khi ngoại tuyến.
 *
 * Chỉ giữ 20 lượt gần nhất: đủ để soi nguồn gốc điểm và xem lại diễn biến,
 * mà không phình localStorage.
 */
import type { RunEvent } from "@/lib/tower/engine";

export const HISTORY_KEY = "twr-run-history-v1";
export const HISTORY_MAX = 20;

export type RunRecord = {
  id: string;
  seed: string;
  daily: boolean;
  ascension: number;
  startedAt: string;
  finishedAt: string;
  /** Số giây hoàn thành. */
  seconds: number;
  floors: number;
  hp: number;
  maxHp: number;
  correct: number;
  answered: number;
  coins: number;
  relics: string[];
  curses: string[];
  win: boolean;
  score: number;
  log: RunEvent[];
};

function safeParse(raw: string | null): RunRecord[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as RunRecord[]).filter((r) => r && typeof r.seed === "string") : [];
  } catch {
    return [];
  }
}

export function readHistory(): RunRecord[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(HISTORY_KEY));
}

export function saveRunRecord(record: RunRecord): RunRecord[] {
  if (typeof window === "undefined") return [];
  const next = [record, ...readHistory().filter((r) => r.id !== record.id)].slice(0, HISTORY_MAX);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function clearHistory() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(HISTORY_KEY);
}

/** Gộp thống kê nhanh cho trang theo dõi cá nhân. */
export function historySummary(rows: RunRecord[]) {
  const runs = rows.length;
  const wins = rows.filter((r) => r.win).length;
  const floors = rows.reduce((s, r) => s + r.floors, 0);
  const answered = rows.reduce((s, r) => s + r.answered, 0);
  const correct = rows.reduce((s, r) => s + r.correct, 0);
  return {
    runs,
    wins,
    winRate: runs ? Math.round((wins / runs) * 100) : 0,
    avgFloors: runs ? Math.round((floors / runs) * 10) / 10 : 0,
    accuracy: answered ? Math.round((correct / answered) * 100) : 0,
    bestScore: rows.reduce((m, r) => Math.max(m, r.score), 0),
  };
}

/** Đếm tần suất di vật / lời nguyền để soi độ cân bằng. */
export function frequency(rows: RunRecord[], field: "relics" | "curses"): { id: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) for (const id of r[field]) map.set(id, (map.get(id) ?? 0) + 1);
  return [...map.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
}
