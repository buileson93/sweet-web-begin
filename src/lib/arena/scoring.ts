/**
 * Đấu trường 1vs1 — các hàm tính điểm THUẦN (không phụ thuộc Supabase).
 * Mọi phép tính điểm/Elo đều nằm ở đây để kiểm thử được và để máy chủ là
 * nguồn sự thật duy nhất; client không bao giờ tự tính điểm.
 */

/** Điểm cơ bản cho một câu trả lời đúng. */
export const BASE_POINTS = 100;
/** Trần điểm thưởng tốc độ. */
export const MAX_SPEED_BONUS = 50;
/** Số câu đúng liên tiếp bắt đầu được thưởng chuỗi. */
export const STREAK_THRESHOLD = 3;
/** Điểm thưởng chuỗi (cộng một lần cho mỗi câu đạt ngưỡng). */
export const STREAK_BONUS = 30;

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Điểm của một câu trong trận đấu.
 * - Sai: 0 điểm.
 * - Đúng: 100 + thưởng tốc độ (tuyến tính theo thời gian còn lại, tối đa 50)
 *   + thưởng chuỗi (+30 khi chuỗi đúng hiện tại >= 3).
 *
 * `msTaken` luôn được kẹp về [0, limitMs] — máy chủ đo thời gian, giá trị lạ bị chuẩn hoá.
 */
export function roundPoints(
  isCorrect: boolean,
  msTaken: number,
  limitMs: number,
  streak: number,
): number {
  if (!isCorrect) return 0;
  const limit = Math.max(1, limitMs);
  const taken = clamp(msTaken, 0, limit);
  const speed = Math.round(MAX_SPEED_BONUS * (1 - taken / limit));
  const streakBonus = streak >= STREAK_THRESHOLD ? STREAK_BONUS : 0;
  return BASE_POINTS + Math.max(0, speed) + streakBonus;
}

/** Làm tròn đối xứng quanh 0 để tổng biến thiên Elo hai bên triệt tiêu nhau. */
function symmetricRound(value: number) {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Hệ số K: người mới (dưới 10 trận) biến thiên nhanh hơn. */
export function kFactor(gamesPlayed: number) {
  return gamesPlayed < 10 ? 48 : 32;
}

/** Kỳ vọng thắng theo công thức Elo chuẩn. */
export function expectedScore(myElo: number, oppElo: number) {
  return 1 / (1 + Math.pow(10, (oppElo - myElo) / 400));
}

/**
 * Biến thiên Elo. `result`: 1 = thắng, 0.5 = hoà, 0 = thua.
 * Với hai đấu thủ cùng số trận đã chơi, tổng delta hai bên luôn bằng 0.
 */
export function eloDelta(
  myElo: number,
  oppElo: number,
  result: 1 | 0.5 | 0,
  gamesPlayed: number,
): number {
  return symmetricRound(kFactor(gamesPlayed) * (result - expectedScore(myElo, oppElo)));
}

export type DuelScoreLine = {
  employeeId: string;
  score: number;
  correct: number;
  /** Tổng thời gian trả lời (ms) — càng nhỏ càng nhanh. */
  totalMs: number;
};

export type WinnerDecision = {
  winnerId: string | null;
  /** Tiêu chí phân định thắng thua. */
  reason: "score" | "correct" | "speed" | "draw";
};

/**
 * Phân định thắng thua: điểm > số câu đúng > tổng thời gian nhanh hơn > hoà.
 */
export function decideWinner(scores: DuelScoreLine[]): WinnerDecision {
  if (scores.length < 2) {
    return { winnerId: scores[0]?.employeeId ?? null, reason: scores.length ? "score" : "draw" };
  }
  const [a, b] = [...scores].sort((x, y) => x.employeeId.localeCompare(y.employeeId));
  if (a.score !== b.score)
    return { winnerId: a.score > b.score ? a.employeeId : b.employeeId, reason: "score" };
  if (a.correct !== b.correct)
    return { winnerId: a.correct > b.correct ? a.employeeId : b.employeeId, reason: "correct" };
  if (a.totalMs !== b.totalMs)
    return { winnerId: a.totalMs < b.totalMs ? a.employeeId : b.employeeId, reason: "speed" };
  return { winnerId: null, reason: "draw" };
}

/** Thời gian còn lại của một câu, tính theo giờ máy chủ (đã bù độ lệch đồng hồ). */
export function remainingMs(
  servedAtIso: string | null,
  seconds: number,
  serverOffsetMs: number,
  nowMs: number,
): number {
  if (!servedAtIso) return seconds * 1000;
  const servedAt = Date.parse(servedAtIso);
  if (!Number.isFinite(servedAt)) return seconds * 1000;
  const serverNow = nowMs + serverOffsetMs;
  return clamp(servedAt + seconds * 1000 - serverNow, 0, seconds * 1000);
}

/** Hạng theo Elo. */
export type EloTier = { key: string; label: string; icon: string };

export function eloTier(elo: number): EloTier {
  if (elo >= 1600) return { key: "diamond", label: "Kim cương", icon: "💎" };
  if (elo >= 1400) return { key: "platinum", label: "Bạch kim", icon: "🛡️" };
  if (elo >= 1200) return { key: "gold", label: "Vàng", icon: "🥇" };
  if (elo >= 1000) return { key: "silver", label: "Bạc", icon: "🥈" };
  return { key: "bronze", label: "Đồng", icon: "🥉" };
}
