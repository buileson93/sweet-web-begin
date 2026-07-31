import type { QuestionKind } from "@/lib/questionKinds";

/** Câu hỏi phát ra trong trận — TUYỆT ĐỐI không kèm bất kỳ trường đáp án nào. */
export type DuelQuestion = {
  index: number;
  kind: QuestionKind;
  question: string;
  options: string[];
  matchLeft: string[];
  imageUrl: string | null;
  optionImages: string[];
};

export type DuelPlayerView = {
  employeeId: string;
  displayName: string;
  unit: string;
  seat: number;
  elo: number;
  score: number;
  correct: number;
  ready: boolean;
  left: boolean;
  answered: boolean;
  avatar: string;
  /** Máu còn lại trong ván so tài. */
  hp: number;
  /** Tổng sát thương đã gây ra. */
  damageDealt: number;
  avatarUrl: string;
  avatarImage: string;
  level: number;
  /** Lớp chiến binh đã chọn cho ván này. */
  classId: string;
  /** Mức máu thấp nhất từng chạm trong ván. */
  lowestHp: number;
  /** Các lượt câu đã kích hoạt kỹ năng (dùng để tính thời gian hồi). */
  skillUses: { skill: string; round: number }[];
};

export type DuelState = {
  duelId: string;
  /** Mã nhân viên của chính người đang xem (do máy chủ xác định từ vé phiên). */
  you: string;
  status: "waiting" | "countdown" | "playing" | "finished" | "cancelled";
  version: number;
  roundCount: number;
  secondsPerRound: number;
  isRanked: boolean;
  /** Ván luyện tập với trợ lý máy. */
  isBot: boolean;
  /** Máu khởi điểm của mỗi bên. */
  hpStart: number;
  currentRound: number;
  roundServedAt: string | null;
  startedAt: string | null;
  serverNow: string;
  quizTitle: string;
  quizId: string | null;
  players: DuelPlayerView[];
  /** Chỉ có khi đang thi đấu. */
  question: DuelQuestion | null;
  /** Kết quả câu vừa chốt (nếu vừa chốt xong). */
  lastResult: RoundResult | null;
  finish: DuelFinish | null;
};

export type RoundResult = {
  roundIndex: number;
  correctText: string;
  explanation: string;
  /** Không ai gây sát thương (cả hai cùng sai). */
  neutral: boolean;
  /** Hai viên xúc xắc quyết định sát thương gốc của câu này. */
  dice: number[];
  /** Sát thương gốc trước khi áp kỹ năng. */
  baseDamage?: number;
  /** Thời điểm máy chủ chốt câu (ISO) — dùng để hai bên đổ xúc xắc cùng lúc. */
  resolvedAt?: string;
  /** Thời lượng hiệu ứng xúc xắc do máy chủ quy định (ms). */
  revealMs?: number;
  /** Cả hai cùng không kịp trả lời — câu bị bỏ trống do hết giờ. */
  timedOut?: boolean;
  /** Diễn giải hiệu ứng kỹ năng đã kích hoạt trong câu. */
  skillNotes?: { employeeId: string; skill: string | null; label: string }[];
  lines: {
    employeeId: string;
    isCorrect: boolean;
    msTaken: number;
    points: number;
    score: number;
    /** Sát thương gây ra ở câu này. */
    damage: number;
    /** Máu còn lại sau câu này. */
    hp: number;
    firstCorrect: boolean;
    /** Kỹ năng đã kích hoạt ở câu này. */
    skill?: string | null;
    /** Người này không kịp trả lời câu này. */
    timedOut?: boolean;
  }[];
};

export type DuelFinish = {
  winnerEmployeeId: string | null;
  reason: "ko" | "hp" | "damage" | "score" | "correct" | "speed" | "draw";
  reasonLabel: string;
  isRanked: boolean;
  rankedNote: string;
  lines: {
    employeeId: string;
    displayName: string;
    score: number;
    correct: number;
    hp: number;
    damageDealt: number;
    eloBefore: number;
    eloAfter: number;
    coins: number;
    newBadges: { code: string; name: string; icon: string }[];
  }[];
};

export type ArenaProfile = {
  employeeId: string;
  displayName: string;
  unit: string;
  elo: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  bestStreak: number;
  coins: number;
  abandons: number;
  abandonRate: number;
  rankedLockedUntil: string | null;
  avatar: string;
  avatarUrl: string;
  avatarImage: string;
  level: number;
  badges: { code: string; name: string; icon: string; earnedAt: string }[];
};

export const DUEL_COLUMNS =
  "id, quiz_id, status, round_count, seconds_per_round, is_ranked, hp_start, current_round, round_served_at, question_ids, option_orders, version, started_at, finished_at, winner_employee_id, note, is_bot";
