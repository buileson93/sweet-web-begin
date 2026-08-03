/**
 * Khoá đáp án đã "chấm ngay" — logic thuần, có test.
 *
 * Vì sao cần cột riêng: nếu chỉ dựa vào "câu này đã có đáp án trong session.answers"
 * thì script có thể dùng autosave (saveExamProgress) ghi thử từng phương án rồi gọi
 * chấm-ngay để biết đúng/sai, tức là biến chấm-ngay thành máy dò đáp án.
 * Danh sách CHỐT nằm riêng trong helpers.checked và chỉ do chấm-ngay ghi vào.
 */
export type AnswerMap = Record<string, unknown>;

/** Đọc danh sách chỉ số câu đã chốt từ cột helpers (jsonb) của phiên thi. */
export function readCheckedIndexes(helpers: unknown): number[] {
  const raw = (helpers as { checked?: unknown } | null)?.checked;
  if (!Array.isArray(raw)) return [];
  return raw.filter((n): n is number => Number.isInteger(n) && (n as number) >= 0);
}

/** Ghi thêm một chỉ số vào danh sách đã chốt (không trùng lặp). */
export function withCheckedIndex(helpers: unknown, index: number): Record<string, unknown> {
  const base = (helpers as Record<string, unknown> | null) ?? {};
  const checked = readCheckedIndexes(helpers);
  return { ...base, checked: checked.includes(index) ? checked : [...checked, index] };
}

/**
 * Lọc gói autosave: bỏ mọi câu đã chốt bằng chấm-ngay để không thể ghi đè đáp án.
 * Câu chưa chốt vẫn được sửa thoải mái như bình thường.
 */
export function filterSavableAnswers<T extends AnswerMap>(incoming: T, checked: number[]): T {
  if (!checked.length) return incoming;
  const locked = new Set(checked.map(String));
  const out: AnswerMap = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (locked.has(key)) continue;
    out[key] = value;
  }
  return out as T;
}
