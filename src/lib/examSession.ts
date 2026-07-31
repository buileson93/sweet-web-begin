import type { ExamSettings, StartExamResult } from "@/lib/exam.server";

/** Khoá lưu phiên thi hiện tại trong sessionStorage. */
export const EXAM_CURRENT_KEY = "exam:current";
export const examKey = (sessionId: string) => "exam:" + sessionId;

/** Cấu hình mặc định cho phiên thi cũ (lưu trước khi bổ sung trường settings). */
export const DEFAULT_EXAM_SETTINGS: ExamSettings = {
  instantFeedback: false,
  allowFiftyFifty: false,
  allowSkip: false,
  streakBonus: false,
  showQuestionMap: true,
  passScore: 50,
};

type StorageLike = Pick<Storage, "getItem" | "removeItem">;

/**
 * Đọc phiên thi từ sessionStorage một cách an toàn.
 * Trả về null khi thiếu dữ liệu, JSON hỏng, hoặc thiếu câu hỏi —
 * nhờ đó trang thi luôn render được thay vì trắng màn hình.
 */
export function restoreExamSession(storage: StorageLike | undefined | null): StartExamResult | null {
  if (!storage) return null;
  let raw: string | null = null;
  try {
    const id = storage.getItem(EXAM_CURRENT_KEY);
    raw = id ? storage.getItem(examKey(id)) : null;
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const s = parsed as Partial<StartExamResult>;
  if (!s.sessionId || !Array.isArray(s.questions) || s.questions.length === 0) return null;

  return {
    ...(s as StartExamResult),
    settings: { ...DEFAULT_EXAM_SETTINGS, ...(s.settings ?? {}) },
    questions: s.questions,
  };
}
