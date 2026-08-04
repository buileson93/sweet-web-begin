/**
 * Ranh giới dữ liệu gửi xuống máy khách trong phòng thi.
 *
 * Nguyên tắc: đề tải xuống trình duyệt CHỈ có nội dung câu hỏi và các phương án
 * đã trộn — tuyệt đối không kèm đáp án đúng, lời giải hay bất kỳ trường nào suy
 * ra được đáp án. Mọi việc chấm (kể cả chấm ngay khi chọn) đều do máy chủ làm và
 * chỉ trả về đúng/sai.
 */
import type { ExamQuestion } from "@/lib/exam/types";

/** Các trường KHÔNG BAO GIỜ được xuất hiện trong gói đề gửi xuống máy khách. */
export const FORBIDDEN_CLIENT_FIELDS = [
  "correct_index",
  "correct_indices",
  "correctIndex",
  "correctIndices",
  "accepted_answers",
  "accepted",
  "correct_order",
  "correctOrder",
  "pairs",
  "explanation",
  "option_explanations",
  "optionExplanations",
  "answer",
  "answerIndex",
  "answerIndices",
  "correctText",
] as const;

/** Chỉ giữ đúng các trường an toàn của một câu hỏi hiển thị. */
export function sanitizeExamQuestion(q: ExamQuestion): ExamQuestion {
  return {
    id: q.id,
    kind: q.kind,
    question: q.question,
    options: q.options,
    matchLeft: q.matchLeft,
    optionImages: q.optionImages,
    imageUrl: q.imageUrl,
    imageAlt: q.imageAlt ?? "",
    points: q.points,
    difficulty: q.difficulty,
    timeLimitSeconds: q.timeLimitSeconds,
  };
}

/** Kiểm tra gói đề: trả về danh sách trường cấm bị lọt (rỗng là an toàn). */
export function findLeakedFields(payload: unknown): string[] {
  const found = new Set<string>();
  const walk = (node: unknown, depth: number) => {
    if (!node || typeof node !== "object" || depth > 6) return;
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, depth + 1));
      return;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if ((FORBIDDEN_CLIENT_FIELDS as readonly string[]).includes(key)) found.add(key);
      walk(value, depth + 1);
    }
  };
  walk(payload, 0);
  return [...found];
}

/** Kết quả chấm ngay gửi xuống máy khách: chỉ đúng/sai, không nội dung đáp án. */
export function checkVerdict(correct: boolean): { correct: boolean } {
  return { correct: Boolean(correct) };
}
