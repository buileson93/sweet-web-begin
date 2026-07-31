/**
 * THÀNH TỰU & HUY HIỆU của Đấu trường — logic THUẦN, không phụ thuộc Supabase/React.
 * Chỉ tính trên dữ liệu so tài 1vs1, không dùng cho phần thi trắc nghiệm.
 */

export type ArenaBadgeCode =
  | "arena_first_blood"
  | "arena_win_10"
  | "arena_win_50"
  | "arena_flawless"
  | "arena_comeback"
  | "arena_streak_5"
  | "arena_big_hit"
  | "arena_bot_slayer";

export type ArenaBadgeDef = {
  code: ArenaBadgeCode;
  name: string;
  description: string;
  icon: string;
  sortOrder: number;
};

export const ARENA_BADGES: ArenaBadgeDef[] = [
  { code: "arena_first_blood", name: "Trận đầu tiên", description: "Hoàn thành ván so tài đầu tiên.", icon: "🎬", sortOrder: 100 },
  { code: "arena_win_10", name: "Tay đấu cứng", description: "Thắng 10 ván so tài.", icon: "🥉", sortOrder: 110 },
  { code: "arena_win_50", name: "Cao thủ sân đấu", description: "Thắng 50 ván so tài.", icon: "🥇", sortOrder: 120 },
  { code: "arena_flawless", name: "Bất bại tuyệt đối", description: "Thắng một ván mà không mất giọt máu nào.", icon: "✨", sortOrder: 130 },
  { code: "arena_comeback", name: "Lật kèo", description: "Thắng khi máu từng rơi xuống dưới 20.", icon: "🔥", sortOrder: 140 },
  { code: "arena_streak_5", name: "Chuỗi thắng 5", description: "Thắng 5 ván liên tiếp.", icon: "⚡", sortOrder: 150 },
  { code: "arena_big_hit", name: "Nhát chém trời giáng", description: "Gây 30 sát thương trở lên trong một đòn.", icon: "💥", sortOrder: 160 },
  { code: "arena_bot_slayer", name: "Vượt qua người máy", description: "Thắng máy luyện tập 5 lần.", icon: "🤖", sortOrder: 170 },
];

export function arenaBadgeByCode(code: string): ArenaBadgeDef | null {
  return ARENA_BADGES.find((b) => b.code === code) ?? null;
}

/** Số liệu tổng hợp của một người chơi sau khi kết thúc một ván. */
export type ArenaAchievementInput = {
  /** Tổng số ván đã đấu (tính cả ván vừa xong). */
  duels: number;
  /** Tổng số ván thắng. */
  wins: number;
  /** Chuỗi thắng hiện tại. */
  streak: number;
  /** Tổng số lần thắng máy luyện tập. */
  botWins: number;
  /** Thắng ván vừa xong hay không. */
  wonThisDuel: boolean;
  /** Máu còn lại của mình khi kết thúc ván. */
  hpLeft: number;
  /** Máu khởi điểm của ván. */
  hpStart: number;
  /** Mức máu thấp nhất từng chạm trong ván. */
  lowestHp: number;
  /** Đòn nặng nhất mình gây ra trong ván. */
  biggestHit: number;
};

/** Ngưỡng sát thương của huy hiệu "Nhát chém trời giáng". */
export const BIG_HIT_THRESHOLD = 30;
/** Ngưỡng máu để tính là "lật kèo". */
export const COMEBACK_HP = 20;

/**
 * Tính danh sách huy hiệu người chơi ĐỦ ĐIỀU KIỆN sau một ván.
 * Trả về mã huy hiệu; nơi gọi tự lọc những mã đã có để không trao lại.
 */
export function evaluateArenaBadges(input: ArenaAchievementInput): ArenaBadgeCode[] {
  const out: ArenaBadgeCode[] = [];
  if (input.duels >= 1) out.push("arena_first_blood");
  if (input.wins >= 10) out.push("arena_win_10");
  if (input.wins >= 50) out.push("arena_win_50");
  if (input.streak >= 5) out.push("arena_streak_5");
  if (input.botWins >= 5) out.push("arena_bot_slayer");
  if (input.biggestHit >= BIG_HIT_THRESHOLD) out.push("arena_big_hit");
  if (input.wonThisDuel && input.hpLeft >= input.hpStart && input.hpStart > 0)
    out.push("arena_flawless");
  if (input.wonThisDuel && input.lowestHp > 0 && input.lowestHp < COMEBACK_HP)
    out.push("arena_comeback");
  return out;
}

/** Lọc ra những huy hiệu MỚI (chưa có trong danh sách đã trao). */
export function newlyEarned(
  earned: readonly string[],
  eligible: readonly ArenaBadgeCode[],
): ArenaBadgeCode[] {
  const have = new Set(earned);
  return eligible.filter((c) => !have.has(c));
}

/**
 * Danh hiệu "chuyên gia" theo bộ đề: xếp theo số câu đúng rồi tới tỉ lệ đúng.
 * Trả về danh sách đã xếp hạng, kèm cờ `expert` cho người đứng đầu.
 */
export type QuizExpertRow = {
  employeeId: string;
  displayName: string;
  correct: number;
  answered: number;
  wins: number;
};

export type RankedExpert = QuizExpertRow & {
  rank: number;
  accuracy: number;
  expert: boolean;
};

/** Số câu tối thiểu để được xét danh hiệu chuyên gia bộ đề. */
export const EXPERT_MIN_ANSWERS = 20;

export function rankQuizExperts(rows: readonly QuizExpertRow[]): RankedExpert[] {
  const sorted = [...rows].sort(
    (a, b) =>
      b.correct - a.correct ||
      b.wins - a.wins ||
      a.answered - b.answered ||
      a.employeeId.localeCompare(b.employeeId),
  );
  return sorted.map((r, i) => ({
    ...r,
    rank: i + 1,
    accuracy: r.answered > 0 ? Math.round((r.correct / r.answered) * 100) : 0,
    expert: i === 0 && r.answered >= EXPERT_MIN_ANSWERS,
  }));
}
