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
};

export type DuelState = {
  duelId: string;
  status: "waiting" | "countdown" | "playing" | "finished" | "cancelled";
  version: number;
  roundCount: number;
  secondsPerRound: number;
  isRanked: boolean;
  currentRound: number;
  roundServedAt: string | null;
  startedAt: string | null;
  serverNow: string;
  quizTitle: string;
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
  lines: {
    employeeId: string;
    isCorrect: boolean;
    msTaken: number;
    points: number;
    score: number;
  }[];
};

export type DuelFinish = {
  winnerEmployeeId: string | null;
  reason: "score" | "correct" | "speed" | "draw";
  isRanked: boolean;
  rankedNote: string;
  lines: {
    employeeId: string;
    displayName: string;
    score: number;
    correct: number;
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
  badges: { code: string; name: string; icon: string; earnedAt: string }[];
};

export const DUEL_COLUMNS =
  "id, quiz_id, status, round_count, seconds_per_round, is_ranked, current_round, round_served_at, question_ids, option_orders, version, started_at, finished_at, winner_employee_id, note";
