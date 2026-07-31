/**
 * Trợ lý luyện tập ("bot") của Đấu trường — phần logic THUẦN, dễ kiểm thử.
 * Dùng khi không có đồng nghiệp nào trực tuyến: nhân viên vẫn luyện phản xạ được.
 */

export type BotTierId = "de" | "vua" | "kho";

export type BotTier = {
  id: BotTierId;
  label: string;
  /** Xác suất trả lời đúng mỗi câu. */
  accuracy: number;
  /** Khoảng thời gian bấm đáp án, tính theo tỉ lệ của thời gian mỗi câu. */
  minRatio: number;
  maxRatio: number;
  /** Danh sách hồ sơ trợ lý cùng mức độ (nhiều bản để nhiều người luyện cùng lúc). */
  employeeIds: string[];
};

export const BOT_TIERS: BotTier[] = [
  {
    id: "de",
    label: "Sao Mai · dễ",
    accuracy: 0.5,
    minRatio: 0.45,
    maxRatio: 0.95,
    employeeIds: [
      "bb000000-0000-4000-8000-000000000001",
      "bb000000-0000-4000-8000-000000000002",
      "bb000000-0000-4000-8000-000000000003",
      "bb000000-0000-4000-8000-000000000004",
    ],
  },
  {
    id: "vua",
    label: "Hải Âu · vừa",
    accuracy: 0.68,
    minRatio: 0.3,
    maxRatio: 0.8,
    employeeIds: [
      "bb000000-0000-4000-8000-000000000011",
      "bb000000-0000-4000-8000-000000000012",
      "bb000000-0000-4000-8000-000000000013",
      "bb000000-0000-4000-8000-000000000014",
    ],
  },
  {
    id: "kho",
    label: "Đại Bàng · khó",
    accuracy: 0.85,
    minRatio: 0.15,
    maxRatio: 0.55,
    employeeIds: [
      "bb000000-0000-4000-8000-000000000021",
      "bb000000-0000-4000-8000-000000000022",
      "bb000000-0000-4000-8000-000000000023",
      "bb000000-0000-4000-8000-000000000024",
    ],
  },
];

/** Tất cả mã nhân viên là trợ lý luyện tập (dùng để ẩn khỏi danh sách người thật). */
export const BOT_EMPLOYEE_IDS = BOT_TIERS.flatMap((t) => t.employeeIds);

export function isBotEmployee(employeeId: string) {
  return BOT_EMPLOYEE_IDS.includes(employeeId);
}

export function tierOf(id: string | undefined): BotTier {
  return BOT_TIERS.find((t) => t.id === id) ?? BOT_TIERS[1];
}

/** Quyết định của trợ lý cho một câu: đúng hay sai và bấm sau bao nhiêu mili giây. */
export function botDecision(
  tier: BotTier,
  limitMs: number,
  rng: () => number = Math.random,
): { isCorrect: boolean; msTaken: number } {
  const limit = Math.max(1000, limitMs);
  const isCorrect = rng() < tier.accuracy;
  const ratio = tier.minRatio + rng() * Math.max(0, tier.maxRatio - tier.minRatio);
  const msTaken = Math.round(Math.min(limit - 200, Math.max(600, limit * ratio)));
  return { isCorrect, msTaken };
}
