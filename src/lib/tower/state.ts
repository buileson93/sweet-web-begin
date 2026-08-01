/**
 * Trạng thái Leo Tháp của một người — toàn bộ nằm trong MỘT ô JSON.
 *
 * Nguyên tắc: dung lượng tăng theo số người, không tăng theo số lần chơi.
 * Vì vậy không có bảng nhật ký từng câu, không có bảng phiên chơi.
 */
import { intervalDays, nextBox } from "@/lib/tower/leitner";

export const STATE_VERSION = 1;
/** Ngưỡng cảnh báo: vượt mức này thì cắt bớt thẻ đã thuộc. */
export const MAX_STATE_BYTES = 64 * 1024;

/** [hộp Leitner, ngày đến hạn dạng YYYY-MM-DD] — mảng cho gọn. */
export type CardEntry = [number, string];
/** [điểm chủ đề, số lượt, số đúng] */
export type TopicEntry = [number, number, number];

export type TowerState = {
  v: number;
  cards: Record<string, CardEntry>;
  topics: Record<string, TopicEntry>;
  unlocked: string[];
  lastRun?: { stage: number; at: string; win: boolean };
};

export const emptyState = (): TowerState => ({ v: STATE_VERSION, cards: {}, topics: {}, unlocked: [] });

const dayOf = (d: Date) => d.toISOString().slice(0, 10);

/** Đọc trạng thái từ máy chủ hoặc IndexedDB, luôn trả về cấu trúc hợp lệ. */
export function normalizeState(raw: unknown): TowerState {
  const src = (raw ?? {}) as Partial<TowerState>;
  const cards: Record<string, CardEntry> = {};
  for (const [id, entry] of Object.entries(src.cards ?? {})) {
    if (!Array.isArray(entry)) continue;
    const box = Number(entry[0]);
    const due = String(entry[1] ?? "");
    if (!Number.isFinite(box) || !due) continue;
    cards[id] = [Math.min(5, Math.max(1, Math.round(box))), due.slice(0, 10)];
  }
  const topics: Record<string, TopicEntry> = {};
  for (const [tag, entry] of Object.entries(src.topics ?? {})) {
    if (!Array.isArray(entry)) continue;
    topics[tag] = [Number(entry[0]) || 1200, Number(entry[1]) || 0, Number(entry[2]) || 0];
  }
  const state: TowerState = {
    v: STATE_VERSION,
    cards,
    topics,
    unlocked: Array.isArray(src.unlocked) ? src.unlocked.filter((x) => typeof x === "string") : [],
  };
  if (src.lastRun) state.lastRun = src.lastRun;
  return state;
}

/** Thẻ đến hạn ôn tính đến hôm nay. */
export function dueCardIds(state: TowerState, now: Date = new Date()): string[] {
  const today = dayOf(now);
  return Object.entries(state.cards)
    .filter(([, [, due]]) => due <= today)
    .sort((a, b) => (a[1][1] < b[1][1] ? -1 : 1))
    .map(([id]) => id);
}

/** Cập nhật lịch ôn sau một chặng — thuần, không chạm mạng. */
export function applyResults(
  state: TowerState,
  results: { questionId: string; correct: boolean; tags?: string[] }[],
  now: Date = new Date(),
): TowerState {
  const cards = { ...state.cards };
  const topics = { ...state.topics };

  for (const r of results) {
    const prev = cards[r.questionId];
    const box = nextBox(prev?.[0] ?? 0, r.correct);
    const due = new Date(now.getTime() + intervalDays(box) * 86_400_000);
    cards[r.questionId] = [box, dayOf(due)];

    for (const rawTag of r.tags ?? []) {
      const tag = rawTag.trim();
      if (!tag) continue;
      const [rating, games, correct] = topics[tag] ?? [1200, 0, 0];
      const k = games < 10 ? 40 : games < 30 ? 24 : 16;
      const delta = Math.round(k * ((r.correct ? 1 : 0) - 0.75));
      topics[tag] = [rating + delta, games + 1, correct + (r.correct ? 1 : 0)];
    }
  }

  return { ...state, cards, topics };
}

/** Cắt bớt thẻ đã thuộc khi trạng thái phình quá ngưỡng. */
export function pruneState(state: TowerState, maxBytes: number = MAX_STATE_BYTES): TowerState {
  if (stateBytes(state) <= maxBytes) return state;
  const entries = Object.entries(state.cards).sort((a, b) => {
    // Bỏ trước: hộp cao nhất và hạn xa nhất (đã thuộc chắc).
    if (a[1][0] !== b[1][0]) return b[1][0] - a[1][0];
    return a[1][1] < b[1][1] ? 1 : -1;
  });
  const cards = { ...state.cards };
  let next: TowerState = { ...state, cards };
  for (const [id, entry] of entries) {
    if (stateBytes(next) <= maxBytes) break;
    if (entry[0] < 5) break; // chỉ bỏ thẻ ở hộp 5
    delete cards[id];
    next = { ...state, cards };
  }
  return next;
}

export function stateBytes(state: TowerState): number {
  return new TextEncoder().encode(JSON.stringify(state)).length;
}

/**
 * Hợp nhất hai trạng thái (chơi trên hai thiết bị):
 * bên nào hộp Leitner cao hơn thì thắng — thiên vị "đã học rồi".
 */
export function mergeStates(a: TowerState, b: TowerState): TowerState {
  const cards: Record<string, CardEntry> = { ...a.cards };
  for (const [id, entry] of Object.entries(b.cards)) {
    const mine = cards[id];
    if (!mine || entry[0] > mine[0] || (entry[0] === mine[0] && entry[1] > mine[1])) cards[id] = entry;
  }
  const topics: Record<string, TopicEntry> = { ...a.topics };
  for (const [tag, entry] of Object.entries(b.topics)) {
    const mine = topics[tag];
    if (!mine || entry[1] > mine[1]) topics[tag] = entry;
  }
  const merged: TowerState = {
    v: STATE_VERSION,
    cards,
    topics,
    unlocked: Array.from(new Set([...a.unlocked, ...b.unlocked])),
  };
  const lastRun = b.lastRun ?? a.lastRun;
  if (lastRun) merged.lastRun = lastRun;
  return merged;
}
