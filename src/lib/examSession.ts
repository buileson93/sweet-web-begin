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
  comboFx: true,
  showQuestionMap: true,
  passPercent: 50,
};

type StorageLike = Pick<Storage, "getItem" | "removeItem">;

/**
 * Đọc phiên thi từ sessionStorage một cách an toàn.
 * Trả về null khi thiếu dữ liệu, JSON hỏng, hoặc thiếu câu hỏi —
 * nhờ đó trang thi luôn render được thay vì trắng màn hình.
 */
export function restoreExamSession(
  storage: StorageLike | undefined | null,
): StartExamResult | null {
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

/** Khoá lưu thông tin đăng ký gần nhất để "Thi lại ngay" không phải nhập lại. */
export const EXAM_LAST_ENTRY_KEY = "exam:last-entry";

export type ExamEntry = {
  quizId: string;
  name: string;
  credential: string;
  extraCredential?: string;
};

export function saveExamEntry(
  storage: Pick<Storage, "setItem"> | undefined | null,
  entry: ExamEntry,
) {
  if (!storage) return;
  try {
    storage.setItem(EXAM_LAST_ENTRY_KEY, JSON.stringify(entry));
  } catch {
    /* bỏ qua khi trình duyệt chặn lưu trữ */
  }
}

export function readExamEntry(
  storage: Pick<Storage, "getItem"> | undefined | null,
): ExamEntry | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(EXAM_LAST_ENTRY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ExamEntry>;
    if (!parsed?.quizId || !parsed.name || !parsed.credential) return null;
    return {
      quizId: parsed.quizId,
      name: parsed.name,
      credential: parsed.credential,
      extraCredential: parsed.extraCredential || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Hợp nhất đáp án lưu trên máy và trên máy chủ khi vào lại phòng thi.
 * Bên nào có seq lớn hơn thì thắng ở các câu bị trùng; câu chỉ có ở một bên luôn được giữ.
 * Khi seq bằng nhau ưu tiên bản local vì đó là máy đang làm bài.
 */
export function mergeAnswers<T>(
  local: Record<string, T> | null | undefined,
  server: Record<string, T> | null | undefined,
  localSeq: number,
  serverSeq: number,
): { answers: Record<string, T>; seq: number } {
  const l = local ?? {};
  const s = server ?? {};
  const serverWins = serverSeq > localSeq;
  const answers: Record<string, T> = serverWins ? { ...l, ...s } : { ...s, ...l };
  return { answers, seq: Math.max(localSeq || 0, serverSeq || 0) };
}
