/**
 * Chấm ngay nhưng KHÔNG lộ đáp án để dò.
 *
 * Vì sao: chấm-ngay mỗi câu chỉ chốt một lần (xem answerLock), nên trong MỘT phiên
 * không dò được. Lỗ hổng còn lại là "thu hoạch nhiều phiên": thi thử nhiều lượt,
 * mỗi lượt cố tình chọn sai để máy chủ đọc hộ đáp án đúng, vài lượt là có full đáp án.
 *
 * Cách chặn: khi SAI, chỉ báo đúng/sai (và giải thích nếu có), không gửi kèm nội dung
 * đáp án đúng. Thí sinh thật vẫn thấy điểm ngay và xem đáp án đầy đủ ở phần
 * "Xem lại bài" sau khi nộp — trải nghiệm gần như không đổi.
 */
export type CheckFeedback = {
  correct: boolean;
  correctText: string;
  explanation: string;
};

/** Lọc dữ liệu phản hồi tức thì trước khi trả về máy khách. */
export function revealForCheck(input: {
  correct: boolean;
  correctText: string;
  explanation?: string | null;
}): CheckFeedback {
  return {
    correct: input.correct,
    // Chỉ xác nhận lại lựa chọn khi thí sinh đã trả lời ĐÚNG (không thêm thông tin mới).
    correctText: input.correct ? input.correctText : "",
    explanation: input.explanation ?? "",
  };
}
