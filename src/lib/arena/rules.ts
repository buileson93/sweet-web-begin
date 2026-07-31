/**
 * Luật chơi thuần của Đấu trường: điều kiện tính hạng, chống bỏ trận,
 * nhiệm vụ hằng ngày (theo giờ Việt Nam).
 */

/** Số trận xếp hạng tối đa mỗi ngày. */
export const MAX_RANKED_PER_DAY = 30;
/** Số trận liên tiếp tối đa với CÙNG một đối thủ còn được tính Elo. */
export const MAX_SAME_OPPONENT_STREAK = 5;
/** Bỏ đủ số trận này trong 1 giờ thì bị khoá xếp hạng. */
export const ABANDON_LIMIT_PER_HOUR = 3;
/** Thời gian khoá xếp hạng (giờ). */
export const RANKED_LOCK_HOURS = 2;
/** Elo bị trừ khi xử thua kỹ thuật chỉ bằng 60% mức bình thường. */
export const TECHNICAL_LOSS_RATIO = 0.6;
/** Giới hạn tần suất gửi đáp án (ms). */
export const ANSWER_RATE_LIMIT_MS = 300;

export type RankedCheckInput = {
  /** Số trận xếp hạng đã chơi hôm nay (giờ Việt Nam). */
  rankedToday: number;
  /** Số trận liên tiếp gần nhất gặp đúng đối thủ này. */
  sameOpponentStreak: number;
  /** Thời điểm hết khoá xếp hạng (ISO) nếu đang bị khoá. */
  lockedUntil?: string | null;
  /** Hai đấu thủ dùng chung một thiết bị. */
  sameDevice: boolean;
  nowMs: number;
};

export type RankedCheck = { ranked: boolean; reason: string };

/** Trận có được tính Elo hay không, kèm lý do bằng tiếng Việt để hiển thị. */
export function isRankedEligible(input: RankedCheckInput): RankedCheck {
  if (input.sameDevice)
    return { ranked: false, reason: "Hai đấu thủ dùng chung một thiết bị nên trận này chỉ để giải trí." };
  if (input.lockedUntil && Date.parse(input.lockedUntil) > input.nowMs)
    return { ranked: false, reason: "Bạn đang bị tạm khoá xếp hạng do bỏ trận nhiều lần." };
  if (input.rankedToday >= MAX_RANKED_PER_DAY)
    return { ranked: false, reason: `Đã đủ ${MAX_RANKED_PER_DAY} trận xếp hạng hôm nay.` };
  if (input.sameOpponentStreak >= MAX_SAME_OPPONENT_STREAK)
    return {
      ranked: false,
      reason: `Đã đấu ${MAX_SAME_OPPONENT_STREAK} trận liên tiếp với cùng đối thủ, các trận sau chỉ để giải trí.`,
    };
  return { ranked: true, reason: "" };
}

/** Múi giờ Việt Nam so với UTC (phút). */
export const VN_OFFSET_MINUTES = 7 * 60;

/** Mốc 00:00 giờ Việt Nam gần nhất trước `nowMs`, trả về ISO (UTC). */
export function vnDayStart(nowMs: number): string {
  const shifted = new Date(nowMs + VN_OFFSET_MINUTES * 60_000);
  const startShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  return new Date(startShifted - VN_OFFSET_MINUTES * 60_000).toISOString();
}

/** Khoá ngày theo giờ Việt Nam, dạng yyyy-mm-dd. */
export function vnDayKey(nowMs: number): string {
  return new Date(nowMs + VN_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

/** Cần reset nhiệm vụ hằng ngày hay chưa (so với lần reset trước). */
export function dailyQuestReset(lastResetIso: string | null, nowMs: number): boolean {
  if (!lastResetIso) return true;
  return vnDayKey(Date.parse(lastResetIso)) !== vnDayKey(nowMs);
}

export type DailyQuest = { code: string; label: string; target: number; coins: number };

/** 3 nhiệm vụ mỗi ngày. Xu chỉ dùng mua trợ giúp và ảnh đại diện. */
export const DAILY_QUESTS: DailyQuest[] = [
  { code: "play_3", label: "Chơi 3 trận", target: 3, coins: 30 },
  { code: "win_1", label: "Thắng 1 trận", target: 1, coins: 40 },
  { code: "correct_15", label: "Trả lời đúng 15 câu", target: 15, coins: 30 },
];

/** Reset mềm Elo cuối mùa: về 1000 + (elo - 1000)/3. */
export function softResetElo(elo: number): number {
  return Math.round(1000 + (elo - 1000) / 3);
}
