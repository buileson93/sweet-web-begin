/** Kiểu dữ liệu dùng chung cho màn "Theo dõi trực tiếp" (an toàn cho client). */

export type LiveSession = {
  id: string;
  quizId: string;
  quizTitle: string;
  candidateName: string;
  unit: string;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  status: string;
  answered: number;
  total: number;
};

export type LivePage = {
  /** Vân tay của dữ liệu; giống nhau nghĩa là không có gì thay đổi. */
  version: string;
  /** false khi client đã có đúng phiên bản này (máy chủ không gửi lại rows). */
  changed: boolean;
  rows: LiveSession[];
  /** Còn phiên cũ hơn để tải thêm hay không. */
  hasMore: boolean;
  activeCount: number;
  submittedCount: number;
  serverNow: string;
};

export type SessionAnswer = {
  index: number;
  questionId: string;
  question: string;
  options: string[];
  answered: boolean;
  answerLabel: string;
  correctLabel: string;
  isCorrect: boolean;
};

export type SessionDevice = {
  ip: string;
  browser: string;
  os: string;
  deviceType: string;
  deviceModel: string;
  screen: string;
  network: string;
  language: string;
  timezone: string;
  isPwa: boolean;
  userAgent: string;
  seenAt: string;
};

export type SessionCandidate = {
  fullName: string;
  position: string;
  unit: string;
  birthDate: string;
  phoneLast4: string;
};

export type SessionDetail = {
  id: string;
  candidateName: string;
  unit: string;
  quizTitle: string;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  status: string;
  points: number;
  bestStreak: number;
  integrityScore: number;
  candidate: SessionCandidate | null;
  device: SessionDevice | null;
  answers: SessionAnswer[];
};

