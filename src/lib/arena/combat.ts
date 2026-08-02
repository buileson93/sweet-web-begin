/**
 * Cơ chế "so tài đấu máu" — logic THUẦN, không phụ thuộc Supabase/React.
 *
 * Luật chơi:
 * - Mỗi đấu thủ có 100 máu.
 * - Ở mỗi câu, ai trả lời ĐÚNG TRƯỚC sẽ gây sát thương cho đối phương.
 * - Sát thương gốc do TUNG HAI XÚC XẮC 6 MẶT (2–12), cộng thêm theo chuỗi
 *   đúng liên tiếp (combo) và theo tốc độ trả lời.
 * - Cả hai cùng sai (hoặc cùng bỏ trống) thì hoà câu đó, không ai mất máu.
 * - Ai hết máu trước thì thua (hạ gục). Hết câu mà cả hai còn máu thì so máu còn lại.
 */

import { applyClassDamage, type ClassId } from "@/lib/arena/classes";
import { applyAttackSkill, applyDefenseSkill, type SkillId } from "@/lib/arena/skills";

/** Máu khởi điểm của mỗi đấu thủ. */
export const HP_START = 100;
/** Số xúc xắc tung mỗi đòn và số mặt của mỗi viên. */
export const DICE_COUNT = 2;
export const DICE_SIDES = 6;
/** Sát thương cộng thêm cho mỗi bậc combo (tối đa 5 bậc). */
export const COMBO_STEP = 3;
/** Số bậc combo tối đa được cộng. */
export const COMBO_MAX_STEPS = 5;
/** Sát thương cộng thêm tối đa nhờ trả lời nhanh. */
export const MAX_SPEED_DAMAGE = 5;

/** Nguồn ngẫu nhiên (tách ra để kiểm thử được). */
export type Rng = () => number;

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Tung hai xúc xắc 6 mặt: trả về từng viên và tổng (2–12). */
export function rollDice(rng: Rng = Math.random): { dice: number[]; total: number } {
  const dice = Array.from({ length: DICE_COUNT }, () => {
    const r = clamp(rng(), 0, 0.999999);
    return Math.floor(r * DICE_SIDES) + 1;
  });
  return { dice, total: dice.reduce((a, b) => a + b, 0) };
}

/**
 * Sát thương của một câu trả lời đúng trước.
 * `streak` là số câu đúng liên tiếp TÍNH CẢ câu này (1 = câu đúng đầu tiên).
 * `diceTotal` là tổng hai xúc xắc đã tung cho đòn đánh này.
 */
export function comboDamage(
  streak: number,
  msTaken: number,
  limitMs: number,
  diceTotal: number,
): number {
  const limit = Math.max(1, limitMs);
  const taken = clamp(msTaken, 0, limit);
  const steps = clamp(Math.floor(streak) - 1, 0, COMBO_MAX_STEPS);
  const speed = Math.round(MAX_SPEED_DAMAGE * (1 - taken / limit));
  const base = clamp(Math.round(diceTotal), DICE_COUNT, DICE_COUNT * DICE_SIDES);
  return base + steps * COMBO_STEP + Math.max(0, speed);
}

export type CombatInput = {
  employeeId: string;
  /** Đã gửi đáp án hay chưa (bỏ trống = không trả lời). */
  answered: boolean;
  isCorrect: boolean;
  msTaken: number;
  /** Chuỗi đúng liên tiếp tính cả câu này. */
  streak: number;
  hpBefore: number;
  /** Kỹ năng đã kích hoạt cho câu này (nếu có). */
  skill?: SkillId | null;
  /** Lớp chiến binh đã chọn trước trận. */
  classId?: ClassId | null;
};

export type CombatLine = {
  employeeId: string;
  /** Sát thương người này gây ra trong câu. */
  damageDealt: number;
  /** Máu bị trừ trong câu. */
  damageTaken: number;
  hpAfter: number;
  /** Người trả lời đúng trước trong câu. */
  firstCorrect: boolean;
};

export type SkillNote = {
  employeeId: string;
  skill: SkillId | null;
  label: string;
};

export type CombatOutcome = {
  lines: CombatLine[];
  /** Không ai gây sát thương (cả hai cùng sai / bỏ trống). */
  neutral: boolean;
  /** Cả hai cùng KHÔNG gửi đáp án — câu bị bỏ trống do hết giờ. */
  timedOut: boolean;
  /** Mã nhân viên bị hạ gục (máu về 0) nếu có. */
  knockedOutId: string | null;
  /** Hai viên xúc xắc đã tung cho đòn đánh (rỗng khi không ai đánh trúng). */
  dice: number[];
  /** Sát thương gốc trước khi áp kỹ năng. */
  baseDamage: number;
  /** Diễn giải hiệu ứng kỹ năng đã kích hoạt trong câu. */
  skillNotes: SkillNote[];
  /** Kết quả khắc chế lớp chiến binh của đòn đánh này. */
  counter: "counter" | "countered" | "even";
};

/** Phân xử sát thương của MỘT câu giữa hai đấu thủ. */
export function resolveRoundCombat(
  inputs: CombatInput[],
  limitMs: number,
  rng: Rng = Math.random,
): CombatOutcome {
  const corrects = inputs
    .filter((i) => i.answered && i.isCorrect)
    .sort((a, b) => a.msTaken - b.msTaken || a.employeeId.localeCompare(b.employeeId));

  const first = corrects[0] ?? null;
  // Hai người cùng đúng và trùng khít mốc thời gian -> xem như hoà câu đó.
  const tie =
    corrects.length > 1 && corrects[0].msTaken === corrects[1].msTaken ? true : false;
  const striker = tie ? null : first;

  const roll = striker ? rollDice(rng) : { dice: [], total: 0 };
  const baseDamage = striker
    ? comboDamage(striker.streak, striker.msTaken, limitMs, roll.total)
    : 0;

  const skillNotes: SkillNote[] = [];
  // Kỹ năng tấn công của người ra đòn.
  const attack = applyAttackSkill(striker?.skill, baseDamage, rng);
  if (striker?.skill && attack.label)
    skillNotes.push({ employeeId: striker.employeeId, skill: striker.skill, label: attack.label });

  const defender = striker ? inputs.find((i) => i.employeeId !== striker.employeeId) : undefined;
  // Kỹ năng phòng thủ của người nhận đòn.
  const defend = applyDefenseSkill(defender?.skill, attack.damage, rng);
  if (defender?.skill && defend.label)
    skillNotes.push({ employeeId: defender.employeeId, skill: defender.skill, label: defend.label });

  // Ưu / nhược của lớp chiến binh và vòng khắc chế bao–búa–kéo.
  const cls = applyClassDamage(striker?.classId, defender?.classId, defend.damage);
  if (striker && cls.label)
    skillNotes.push({ employeeId: striker.employeeId, skill: null, label: cls.label });

  const finalDamage = cls.damage;

  // Cả hai cùng bỏ trống (hết giờ không ai trả lời) -> mỗi người tự mất máu phạt.
  const timedOut = inputs.length > 0 && inputs.every((i) => !i.answered);
  const idlePenalty = timedOut ? TIMEOUT_HP_LOSS : 0;

  const lines: CombatLine[] = inputs.map((i) => {
    const isStriker = !!striker && striker.employeeId === i.employeeId;
    const taken = (striker && !isStriker ? finalDamage : 0) + idlePenalty;
    return {
      employeeId: i.employeeId,
      damageDealt: isStriker ? finalDamage : 0,
      damageTaken: taken,
      hpAfter: Math.max(0, i.hpBefore - taken),
      firstCorrect: isStriker,
    };
  });

  const ko = lines.find((l) => l.hpAfter <= 0) ?? null;
  return {
    lines,
    neutral: (!striker || finalDamage <= 0) && idlePenalty <= 0,
    timedOut,

    knockedOutId: ko ? ko.employeeId : null,
    dice: roll.dice,
    baseDamage,
    skillNotes,
    counter: cls.verdict,
  };
}


export type HpScoreLine = {
  employeeId: string;
  hp: number;
  damageDealt: number;
  correct: number;
  totalMs: number;
};

export type HpWinner = {
  winnerId: string | null;
  reason: "ko" | "hp" | "damage" | "correct" | "speed" | "draw";
};

/**
 * Phân định thắng thua theo máu:
 * hạ gục > máu còn lại > tổng sát thương > số câu đúng > tổng thời gian > hoà.
 */
export function decideWinnerByHp(lines: HpScoreLine[]): HpWinner {
  if (lines.length < 2)
    return { winnerId: lines[0]?.employeeId ?? null, reason: lines.length ? "hp" : "draw" };
  const [a, b] = [...lines].sort((x, y) => x.employeeId.localeCompare(y.employeeId));

  const aDown = a.hp <= 0;
  const bDown = b.hp <= 0;
  if (aDown !== bDown)
    return { winnerId: aDown ? b.employeeId : a.employeeId, reason: "ko" };
  if (a.hp !== b.hp)
    return { winnerId: a.hp > b.hp ? a.employeeId : b.employeeId, reason: "hp" };
  if (a.damageDealt !== b.damageDealt)
    return {
      winnerId: a.damageDealt > b.damageDealt ? a.employeeId : b.employeeId,
      reason: "damage",
    };
  if (a.correct !== b.correct)
    return { winnerId: a.correct > b.correct ? a.employeeId : b.employeeId, reason: "correct" };
  if (a.totalMs !== b.totalMs)
    return { winnerId: a.totalMs < b.totalMs ? a.employeeId : b.employeeId, reason: "speed" };
  return { winnerId: null, reason: "draw" };
}

/** Nhãn tiếng Việt cho tiêu chí phân định. */
export function winReasonLabel(reason: HpWinner["reason"]): string {
  switch (reason) {
    case "ko":
      return "Hạ gục";
    case "hp":
      return "Còn nhiều máu hơn";
    case "damage":
      return "Gây nhiều sát thương hơn";
    case "correct":
      return "Nhiều câu đúng hơn";
    case "speed":
      return "Phản xạ nhanh hơn";
    default:
      return "Hoà";
  }
}
