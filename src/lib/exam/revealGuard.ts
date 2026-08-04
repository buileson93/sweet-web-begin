/**
 * Chống "dò đáp án" bằng cách mở phiên thi nháp.
 *
 * Kịch bản gian lận thật: bật chế độ chấm-ngay, chốt từng câu để biết đáp án đúng,
 * thoát phiên (không nộp), rồi mở phiên mới và điền lại trong vài giây.
 * Không thể phát hiện bằng tốc độ (nhiều người làm nhanh thật), nên chặn ở GỐC:
 * câu nào đã bị lộ đáp án cho thí sinh đó thì KHÔNG được xuất hiện ở phiên sau,
 * chừng nào ngân hàng câu hỏi còn đủ câu chưa lộ.
 *
 * Logic thuần tuý, không phụ thuộc Supabase, để kiểm thử được.
 */

export type PriorSession = {
  /** Danh sách id câu hỏi theo đúng thứ tự đã phát cho thí sinh. */
  questionIds: readonly string[];
  /** Cột helpers (jsonb) của phiên — chứa mảng `checked` do chấm-ngay ghi. */
  helpers?: unknown;
  /** Phiên đã nộp bài hay chưa (phiên bỏ dở đáng ngờ hơn nhiều). */
  submitted?: boolean;
};

export type RevealedQuestions = {
  /** Câu bị lộ ở phiên BỎ DỞ — ưu tiên loại bỏ tuyệt đối. */
  fromAbandoned: string[];
  /** Câu bị lộ ở phiên đã nộp — loại bỏ nếu ngân hàng còn đủ câu. */
  fromSubmitted: string[];
};

/** Đọc mảng chỉ số câu đã chốt (chấm-ngay) từ cột helpers. */
function checkedIndexes(helpers: unknown): number[] {
  const raw = (helpers as { checked?: unknown } | null)?.checked;
  if (!Array.isArray(raw)) return [];
  return raw.filter((n): n is number => Number.isInteger(n) && (n as number) >= 0);
}

/** Gom danh sách câu hỏi đã bị lộ đáp án qua các phiên trước của cùng thí sinh. */
export function revealedFromSessions(sessions: readonly PriorSession[]): RevealedQuestions {
  const abandoned = new Set<string>();
  const submitted = new Set<string>();
  for (const s of sessions ?? []) {
    const ids = s.questionIds ?? [];
    for (const index of checkedIndexes(s.helpers)) {
      const id = ids[index];
      if (!id) continue;
      if (s.submitted) submitted.add(id);
      else abandoned.add(id);
    }
  }
  // Câu đã lộ ở phiên bỏ dở thì không cần liệt kê lại ở nhóm nhẹ hơn.
  for (const id of abandoned) submitted.delete(id);
  return { fromAbandoned: [...abandoned], fromSubmitted: [...submitted] };
}

/**
 * Lọc ngân hàng câu hỏi cho phiên mới.
 * Ưu tiên: bỏ hết câu đã lộ; nếu không còn đủ câu thì bù lại theo thứ tự
 * "ít nhạy cảm trước" (đã nộp → bỏ dở) để phiên thi vẫn mở được.
 */
export function excludeRevealed<T extends { id: string }>(
  pool: readonly T[],
  revealed: RevealedQuestions,
  wanted: number,
): T[] {
  const hard = new Set(revealed.fromAbandoned ?? []);
  const soft = new Set(revealed.fromSubmitted ?? []);
  const fresh = pool.filter((q) => !hard.has(q.id) && !soft.has(q.id));
  if (fresh.length >= wanted) return fresh;

  const softBack = pool.filter((q) => soft.has(q.id));
  const withSoft = [...fresh, ...softBack];
  if (withSoft.length >= wanted) return withSoft;

  const hardBack = pool.filter((q) => hard.has(q.id));
  return [...withSoft, ...hardBack];
}
