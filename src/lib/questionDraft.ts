/**
 * Tự lưu bản nháp câu hỏi đang soạn vào localStorage để không mất công khi
 * lỡ đóng tab. Bản nháp gắn theo (cuộc thi, câu đang sửa) và chỉ giữ 24 giờ.
 */

const PREFIX = "vatm.question-draft.";
export const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type DraftEnvelope<T> = { savedAt: number; data: T };

/** Khoá lưu nháp: mỗi cuộc thi tách riêng bản "thêm mới" và từng câu đang sửa. */
export function draftKey(quizId: string, editingId?: string | null): string {
  return `${PREFIX}${quizId}:${editingId ?? "new"}`;
}

/** Bản nháp có nội dung đáng để hỏi khôi phục hay không. */
export function isDraftMeaningful(form: { question?: string; options?: string[] }): boolean {
  if ((form.question ?? "").trim().length >= 3) return true;
  return (form.options ?? []).some((o) => o.trim().length > 0);
}

/** Bản nháp còn hạn hay không. */
export function isDraftFresh(envelope: DraftEnvelope<unknown>, now = Date.now()): boolean {
  return now - envelope.savedAt <= DRAFT_MAX_AGE_MS;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function saveDraft<T>(key: string, data: T): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify({ savedAt: Date.now(), data } satisfies DraftEnvelope<T>));
  } catch {
    /* hết dung lượng thì bỏ qua, không làm hỏng thao tác soạn thảo */
  }
}

export function loadDraft<T>(key: string): T | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (!isDraftFresh(parsed)) {
      store.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  storage()?.removeItem(key);
}
