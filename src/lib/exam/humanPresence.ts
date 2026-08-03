/**
 * Phát hiện "đáp án gửi hàng loạt" — dấu hiệu script gọi thẳng API thay vì làm bài thật.
 *
 * Vì sao cần: người thi thật gõ/chọn từng câu nên máy khách tự lưu tiến độ nhiều lần,
 * `answers_seq` tăng dần (thường xấp xỉ số câu đã làm). Script thường chỉ gọi MỘT lần
 * kèm toàn bộ đáp án, nên answers_seq rất nhỏ so với số câu đã trả lời.
 *
 * Nguyên tắc: KHÔNG phạt oan. Chỉ tính điểm khi CẢ HAI điều kiện cùng xảy ra:
 * (1) đáp án dồn cục bất thường, và (2) tổng thời gian ngắn tới mức không thể đọc hết đề.
 * Người thi mạng chập chờn (ít lần lưu) nhưng làm đủ thời gian sẽ không bị ảnh hưởng.
 */

/** Số câu tối thiểu để bắt đầu xét (bài quá ngắn thì bỏ qua). */
export const BULK_MIN_ANSWERS = 5;
/** Số câu trung bình trên mỗi lần lưu, vượt mức này là dồn cục bất thường. */
export const BULK_ANSWERS_PER_SAVE = 10;
/** Thời gian tối thiểu cho mỗi câu (giây) để coi là có làm bài thật. */
export const HUMAN_MIN_SECONDS_PER_ANSWER = 2;

export type PresenceInput = {
  /** Số câu đã có đáp án khi nộp. */
  answered: number;
  /** Giá trị answers_seq của phiên = số lần máy khách lưu tiến độ. */
  answersSeq: number;
  /** Tổng thời gian làm bài phía máy chủ (giây). */
  timeSeconds: number;
};

/**
 * Điểm liêm chính cộng thêm khi phiên thi không có dấu hiệu thao tác của con người.
 * Trả về 0 nghĩa là bình thường.
 */
export function bulkSubmitPenalty({ answered, answersSeq, timeSeconds }: PresenceInput): number {
  if (!Number.isFinite(answered) || !Number.isFinite(answersSeq)) return 0;
  if (!Number.isFinite(timeSeconds)) return 0;
  if (answered < BULK_MIN_ANSWERS) return 0;

  // Quá nhanh so với mức tối thiểu để đọc đề? Nếu không thì tha, dù ít lần lưu.
  if (timeSeconds >= answered * HUMAN_MIN_SECONDS_PER_ANSWER) return 0;

  const saves = Math.max(0, Math.trunc(answersSeq));
  if (saves <= 1) return 12; // toàn bộ đáp án đến trong một request duy nhất
  if (answered / saves >= BULK_ANSWERS_PER_SAVE) return 8;
  return 0;
}

/** Lý do hiển thị cho quản trị khi bài bị huỷ vì gửi hàng loạt. */
export function bulkSubmitReason(input: PresenceInput): string {
  return `Đáp án gửi hàng loạt bất thường (${input.answered} câu / ${Math.max(0, Math.trunc(input.answersSeq))} lần lưu / ${input.timeSeconds}s)`;
}
