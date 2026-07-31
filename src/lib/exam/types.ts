import { type Difficulty, type QuestionKind } from "@/lib/questionKinds";

export type ExamQuestion = {
  id: string;
  kind: QuestionKind;
  question: string;
  /** Phương án hiển thị (đã trộn). Với "matching" đây là cột phải, với "ordering" là các mục cần sắp xếp. */
  options: string[];
  /** Cột trái của câu nối cặp. */
  matchLeft: string[];
  imageUrl: string | null;
  /** Ảnh riêng của từng phương án, ĐÃ hoán vị cùng thứ tự với `options`. */
  optionImages: string[];
  points: number;
  difficulty: Difficulty;
  timeLimitSeconds: number | null;
};

export type ExamSettings = {
  instantFeedback: boolean;
  allowFiftyFifty: boolean;
  allowSkip: boolean;
  streakBonus: boolean;
  showQuestionMap: boolean;
  /** Mức điểm đạt tính theo PHẦN TRĂM (0-100). */
  passPercent: number;
};

export type StartExamResult = {
  sessionId: string;
  /** Mã nộp bài dùng một lần — bắt buộc khi nộp, hết hiệu lực ngay sau đó. */
  submitToken: string;
  /** Lần thi thứ mấy của nhân viên này ở cuộc thi này */
  attempt: number;
  /** Điểm phần trăm cao nhất đã đạt trước đó (0 nếu chưa thi) */
  bestPercent: number;
  candidateName: string;
  unit: string;
  quizTitle: string;
  durationMinutes: number;
  expiresAt: string;
  serverNow: string;
  settings: ExamSettings;
  maxPoints: number;
  questions: ExamQuestion[];
};

export type ReviewItem = {
  kind: QuestionKind;
  question: string;
  options: string[];
  matchLeft: string[];
  imageUrl: string | null;
  correct: boolean;
  answered: boolean;
  /** Mô tả đáp án người thi đã chọn, dạng chữ. */
  chosenText: string;
  correctText: string;
  explanation: string;
  points: number;
};

/** Kinh nghiệm nhận được sau một lượt thi (null nếu không xác định được nhân viên). */
export type XpAward = {
  gained: number;
  xp: number;
  level: number;
  leveledUp: boolean;
  title: string;
  into: number;
  need: number;
  percent: number;
};

export type SubmitExamResult = {

  score: number;
  total: number;
  points: number;
  maxPoints: number;
  bestStreak: number;
  passed: boolean;
  /** Mức điểm đạt của cuộc thi, tính theo PHẦN TRĂM (0-100). */
  passPercent: number;
  timeSeconds: number;
  disqualified: boolean;
  quizId: string;
  quizTitle: string;
  previousBestPercent: number;
  improved: boolean;
  review: ReviewItem[];
  xp: XpAward | null;

};

export type HistoryQuestion = {
  question: string;
  correct: boolean;
  answered: boolean;
  chosenText: string | null;
  correctText: string;
};

export type HistoryAttempt = {
  sessionId: string;
  quizTitle: string;
  startedAt: string;
  finishedAt: string | null;
  status: "submitted" | "disqualified" | "abandoned" | "active";
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  timeSeconds: number;
  questions: HistoryQuestion[];
};

export type ExamHistory = {
  candidateName: string;
  unitName: string | null;
  attempts: HistoryAttempt[];
  bestPercent: number;
  passedCount: number;
};

/** Cột truy vấn dùng chung cho câu hỏi và cuộc thi. */
export const QUESTION_COLUMNS =
  "id, question, options, correct_index, image_url, option_images, kind, correct_indices, accepted_answers, pairs, correct_order, difficulty, tags, points, explanation, time_limit_seconds, order_index";

export const QUIZ_COLUMNS =
  "id, title, is_active, status, intro_markdown, start_time, end_time, question_count, duration_minutes, shuffle_options, shuffle_questions, pass_percent, room_password, max_attempts, instant_feedback, allow_fifty_fifty, allow_skip, streak_bonus, show_question_map, negative_marking, blueprint";
