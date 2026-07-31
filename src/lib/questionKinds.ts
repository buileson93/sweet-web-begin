/**
 * Định nghĩa dùng chung cho các loại câu hỏi (an toàn với cả client và server).
 */

export type QuestionKind = "single" | "true_false" | "multi" | "fill_blank" | "matching" | "ordering";

export const QUESTION_KINDS: { value: QuestionKind; label: string; hint: string }[] = [
  { value: "single", label: "Một đáp án", hint: "Chọn 1 phương án đúng trong nhiều phương án." },
  { value: "true_false", label: "Đúng / Sai", hint: "Nhận định đúng hay sai." },
  { value: "multi", label: "Nhiều đáp án", hint: "Chọn tất cả phương án đúng, sai một phương án là mất điểm." },
  { value: "fill_blank", label: "Điền đáp án", hint: "Người thi gõ đáp án, hệ thống so khớp với danh sách chấp nhận." },
  { value: "matching", label: "Nối cặp", hint: "Nối mỗi mục bên trái với mục tương ứng bên phải." },
  { value: "ordering", label: "Sắp xếp", hint: "Sắp xếp các mục theo đúng thứ tự." },
];

export const KIND_LABEL: Record<QuestionKind, string> = Object.fromEntries(
  QUESTION_KINDS.map((k) => [k.value, k.label]),
) as Record<QuestionKind, string>;

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Dễ" },
  { value: "medium", label: "Trung bình" },
  { value: "hard", label: "Khó" },
];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Dễ",
  medium: "Trung bình",
  hard: "Khó",
};

/** Giá trị trả lời của một câu, tuỳ theo loại câu hỏi. */
export type AnswerValue = number | number[] | string | Record<string, number>;

/** Tỉ lệ bốc đề theo độ khó, tính bằng số câu. */
export type Blueprint = {
  easy?: number;
  medium?: number;
  hard?: number;
  tags?: Record<string, number>;
};

export function isAnswered(kind: QuestionKind, value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  switch (kind) {
    case "multi":
      return Array.isArray(value) && value.length > 0;
    case "fill_blank":
      return typeof value === "string" && value.trim().length > 0;
    case "matching":
      return typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
    case "ordering":
      return Array.isArray(value) && value.length > 0;
    default:
      return typeof value === "number" && value >= 0;
  }
}

/** Chuẩn hoá văn bản cho câu điền đáp án: bỏ dấu, hạ chữ thường, gộp khoảng trắng. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
