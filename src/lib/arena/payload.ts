import {
  baseOptions,
  optionImagesOf,
  pairsOf,
  permuteByOrder,
  type QuestionRow,
} from "@/lib/grading";
import type { DuelQuestion } from "@/lib/arena/types";

/** Các khoá TUYỆT ĐỐI không được xuất hiện trong payload gửi xuống trình duyệt. */
export const FORBIDDEN_KEYS = [
  "correct_index",
  "correct_indices",
  "accepted_answers",
  "correct_order",
  "pairs",
] as const;

/**
 * Dựng câu hỏi để phát cho hai đấu thủ (sự kiện round.start).
 * Chỉ lấy đúng phần hiển thị; mọi thông tin đáp án bị loại bỏ tại đây.
 */
export function buildRoundPayload(
  row: QuestionRow,
  order: number[],
  index: number,
): DuelQuestion {
  const display = baseOptions(row);
  return {
    index,
    kind: row.kind,
    question: row.question,
    options: permuteByOrder(display, order, ""),
    optionImages: permuteByOrder(optionImagesOf(row), order, ""),
    matchLeft: row.kind === "matching" ? pairsOf(row).map((p) => p.left) : [],
    imageUrl: row.image_url ?? null,
  };
}
