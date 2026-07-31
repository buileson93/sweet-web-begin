/**
 * Barrel re-export: giữ nguyên đường import cũ "@/lib/exam.server".
 * Cài đặt thật nằm trong thư mục src/lib/exam/.
 */
export { PASS_PERCENT_DEFAULT } from "@/lib/grading";

export type {
  ExamQuestion,
  ExamSettings,
  StartExamResult,
  ReviewItem,
  SubmitExamResult,
  HistoryQuestion,
  HistoryAttempt,
  ExamHistory,
} from "@/lib/exam/types";

export {
  startExamSession,
  abandonExamSession,
  autoSubmitExpiredSessions,
} from "@/lib/exam/session.server";

export {
  submitExamSession,
  checkExamAnswer,
  saveExamProgress,
  getExamProgress,
} from "@/lib/exam/submit.server";

export { useFiftyFifty, reportExamEvent } from "@/lib/exam/helpers.server";

export { getExamHistoryFor } from "@/lib/exam/history.server";
