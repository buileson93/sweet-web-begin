/**
 * LUẬT PHÒNG — nơi duy nhất quy định "sai mất bao nhiêu máu" và "đúng được gì".
 *
 * Mọi phòng đều có trắc nghiệm kiến thức, khác nhau ở số câu và mức phạt:
 * - Giao tranh: 5 câu, sai −8 máu.
 * - Tinh anh:   7 câu khó hơn, sai −12 máu.
 * - Trùm:       7 câu, sai −15 máu, kèm luật riêng của trùm.
 * - Sự kiện:    1 câu thử thách, sai −5 máu, đúng nhận thưởng của sự kiện.
 * - Cửa hàng:   1 câu mặc cả, sai không mất máu nhưng mất ưu đãi.
 * - Lửa trại:   1 câu ôn bài, sai không mất máu nhưng hồi ít hơn.
 *
 * Đúng liên tiếp (combo) là phần thưởng chính: mỗi mốc cho một khoản thưởng khác nhau.
 */
import type { RoomKind } from "@/lib/tower/map";

export type RoomRule = {
  /** Số câu trắc nghiệm chính của phòng (0 = phòng chỉ có một câu thử thách). */
  questions: number;
  /** Máu mất khi trả lời sai một câu. */
  wrongHp: number;
  /** Số câu thử thách trước khi mở nội dung phòng (sự kiện/cửa hàng/lửa trại). */
  challenge: number;
  /** Trần thiệt hại của cả phòng, theo % máu tối đa — không phòng nào một phát xoá sổ. */
  maxLossPct: number;
  /** Mô tả ngắn để hiển thị trong phòng. */
  rule: string;
};

export const ROOM_RULES: Record<RoomKind, RoomRule> = {
  combat: {
    questions: 5,
    wrongHp: 7,
    challenge: 0,
    maxLossPct: 0.35,
    rule: "5 câu · mỗi câu sai −7 máu (tối đa −35% máu) · đúng liên tiếp tăng sát thương",
  },
  elite: {
    questions: 7,
    wrongHp: 10,
    challenge: 0,
    maxLossPct: 0.45,
    rule: "7 câu khó hơn · mỗi câu sai −10 máu (tối đa −45% máu) · thưởng di vật hiếm",
  },
  boss: {
    questions: 7,
    wrongHp: 12,
    challenge: 0,
    maxLossPct: 0.55,
    rule: "7 câu · mỗi câu sai −12 máu (tối đa −55% máu) · trùm có luật riêng",
  },
  event: { questions: 0, wrongHp: 5, challenge: 1, maxLossPct: 0.1, rule: "1 câu thử thách · sai −5 máu · đúng được cộng thưởng" },
  shop: { questions: 0, wrongHp: 0, challenge: 1, maxLossPct: 0, rule: "1 câu mặc cả · đúng giảm 30% mọi giá · sai giữ giá gốc" },
  campfire: { questions: 0, wrongHp: 0, challenge: 1, maxLossPct: 0, rule: "1 câu ôn bài · đúng hồi thêm 10% máu tối đa" },
};

/** Trần máu có thể mất trong một phòng (làm tròn, tối thiểu 1 khi phòng có phạt). */
export function roomLossCap(kind: RoomKind, maxHp: number): number {
  const pct = ROOM_RULES[kind].maxLossPct;
  if (pct <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(1, Math.round(maxHp * pct));
}


/** Mốc thưởng khi trả lời đúng liên tiếp. */
export type ComboReward = { at: number; label: string; hp?: number; shield?: number; coins?: number; doubleDamage?: boolean };

export const COMBO_REWARDS: ComboReward[] = [
  { at: 3, label: "Chuỗi 3 — nhịp tay đều: +2 máu, +5 xu", hp: 2, coins: 5 },
  { at: 5, label: "Chuỗi 5 — bùng nổ: đòn này nhân đôi sát thương, +10 xu", coins: 10, doubleDamage: true },
  { at: 7, label: "Chuỗi 7 — khiên tự tin: +8 khiên", shield: 8 },
  { at: 10, label: "Chuỗi 10 — kiểm soát tuyệt đối: +10 máu, +25 xu", hp: 10, coins: 25 },
];

/** Thưởng ứng với đúng mốc combo vừa đạt (không có mốc thì trả về undefined). */
export function comboRewardAt(combo: number): ComboReward | undefined {
  return COMBO_REWARDS.find((r) => r.at === combo);
}

/** Máu mất khi sai một câu ở phòng này, đã tính hệ số của trùm/lời nguyền/di vật. */
export function wrongDamage(kind: RoomKind, takenPct: number, reducePct: number): number {
  const base = ROOM_RULES[kind].wrongHp;
  if (base <= 0) return 0;
  return Math.max(1, Math.round(base * (1 + takenPct) * Math.max(0.2, 1 - reducePct)));
}
