/**
 * Cơ chế "so tài đấu máu" — logic THUẦN, không phụ thuộc Supabase/React.
 *
 * Luật chơi:
 * - Mỗi đấu thủ có 100 máu.
 * - Ở mỗi câu, ai trả lời ĐÚNG TRƯỚC sẽ gây sát thương cho đối phương.
 * - Sát thương gốc 10, cộng thêm theo chuỗi đúng liên tiếp (combo) và theo tốc độ.
 * - Cả hai cùng sai (hoặc cùng bỏ trống) thì hoà câu đó, không ai mất máu.
 * - Ai hết máu trước thì thua (hạ gục). Hết câu mà cả hai còn máu thì so máu còn lại.
 */

/** Máu khởi điểm của mỗi đấu thủ. */
export const HP_START = 100;
/** Sát thương gốc cho một câu trả lời đúng trước. */
export const BASE_DAMAGE = 10;
/** Sát thương cộng thêm cho mỗi bậc combo (tối đa 5 bậc). */
export const COMBO_STEP = 3;
/** Số bậc combo tối đa được cộng. */
export const COMBO_MAX_STEPS = 5;
/** Sát thương cộng thêm tối đa nhờ trả lời nhanh. */
export const MAX_SPEED_DAMAGE = 5;

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Sát thương của một câu trả lời đúng trước.
 * `streak` là số câu đúng liên tiếp TÍNH CẢ câu này (1 = câu đúng đầu tiên).
 */
export function comboDamage(streak: number, msTaken: number, limitMs: number): number {
  const limit = Math.max(1, limitMs);
  const taken = clamp(msTaken, 0, limit);
  const steps = clamp(Math.floor(streak) - 1, 0, COMBO_MAX_STEPS);
  const speed = Math.round(MAX_SPEED_DAMAGE * (1 - taken / limit));
  return BASE_DAMAGE + steps * COMBO_STEP + Math.max(0, speed);
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

export type CombatOutcome = {
  lines: CombatLine[];
  /** Không ai gây sát thương (cả hai cùng sai / bỏ trống). */
  neutral: boolean;
  /** Mã nhân viên bị hạ gục (máu về 0) nếu có. */
  knockedOutId: string | null;
};

/** Phân xử sát thương của MỘT câu giữa hai đấu thủ. */
export function resolveRoundCombat(inputs: CombatInput[], limitMs: number): CombatOutcome {
  const corrects = inputs
    .filter((i) => i.answered && i.isCorrect)
    .sort((a, b) => a.msTaken - b.msTaken || a.employeeId.localeCompare(b.employeeId));

  const first = corrects[0] ?? null;
  // Hai người cùng đúng và trùng khít mốc thời gian -> xem như hoà câu đó.
  const tie =
    corrects.length > 1 && corrects[0].msTaken === corrects[1].msTaken ? true : false;
  const striker = tie ? null : first;

  const damage = striker ? comboDamage(striker.streak, striker.msTaken, limitMs) : 0;

  const lines: CombatLine[] = inputs.map((i) => {
    const isStriker = !!striker && striker.employeeId === i.employeeId;
    const taken = striker && !isStriker ? damage : 0;
    return {
      employeeId: i.employeeId,
      damageDealt: isStriker ? damage : 0,
      damageTaken: taken,
      hpAfter: Math.max(0, i.hpBefore - taken),
      firstCorrect: isStriker,
    };
  });

  const ko = lines.find((l) => l.hpAfter <= 0) ?? null;
  return { lines, neutral: !striker, knockedOutId: ko ? ko.employeeId : null };
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
