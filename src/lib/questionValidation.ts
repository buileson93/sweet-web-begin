/**
 * Kiểm tra hợp lệ cho biểu mẫu soạn câu hỏi.
 *
 * Toàn bộ hàm ở đây là hàm THUẦN (không phụ thuộc React/Supabase) để có thể
 * kiểm thử độc lập. Thông báo trả về bằng tiếng Việt, gắn theo TÊN TRƯỜNG để
 * giao diện hiển thị ngay dưới ô nhập thay vì đổ ra toast chung.
 */

import { normalizeText, type Difficulty, type QuestionKind } from "@/lib/questionKinds";

export type Pair = { left: string; right: string };

/** Dữ liệu tối thiểu cần để kiểm tra một câu hỏi. */
export type QuestionDraftInput = {
  question: string;
  kind: QuestionKind;
  options: string[];
  correct_index: number;
  correct_indices: number[];
  /** Mỗi dòng là một đáp án được chấp nhận (dạng thô từ ô nhập nhiều dòng). */
  accepted_answers: string;
  pairs: Pair[];
  points?: number | string;
  time_limit_seconds?: number | string | null;
  difficulty?: Difficulty;
};

/** Tên trường có thể gắn lỗi/cảnh báo. */
export type QuestionField =
  | "question"
  | "options"
  | "correct"
  | "accepted_answers"
  | "pairs"
  | "points"
  | "time_limit_seconds";

export type ValidationResult = {
  /** Lỗi chặn lưu. */
  errors: Partial<Record<QuestionField, string>>;
  /** Cảnh báo mềm, vẫn cho lưu. */
  warnings: Partial<Record<QuestionField, string>>;
};

/** Giới hạn tối đa cho thời gian riêng của một câu (giây). */
export const MAX_TIME_LIMIT_SECONDS = 600;

/** Chuẩn hoá giá trị ô "Giới hạn thời gian": rỗng/0 nghĩa là dùng giờ chung. */
export function parseTimeLimit(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const raw = typeof value === "string" ? value.trim() : value;
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(MAX_TIME_LIMIT_SECONDS, Math.round(n));
}

/** Tách danh sách đáp án chấp nhận từ ô nhập nhiều dòng. */
export function parseAcceptedAnswers(raw: string): string[] {
  return raw
    .split("\n")
    .map((a) => a.trim())
    .filter(Boolean);
}

/** Các phương án sau khi bỏ khoảng trắng thừa (giữ nguyên vị trí). */
export function trimmedOptions(options: string[]): string[] {
  return options.map((o) => o.trim());
}

function hasDuplicate(values: string[]): boolean {
  const seen = new Set<string>();
  for (const v of values) {
    const key = normalizeText(v) || v.toLowerCase();
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/**
 * Kiểm tra toàn bộ biểu mẫu.
 * @param existing danh sách câu hỏi đã có trong CÙNG cuộc thi (để cảnh báo trùng).
 * @param editingId id câu đang sửa (bỏ qua chính nó khi so trùng).
 */
export function validateQuestionDraft(
  input: QuestionDraftInput,
  existing: { id: string; question: string }[] = [],
  editingId?: string | null,
): ValidationResult {
  const errors: ValidationResult["errors"] = {};
  const warnings: ValidationResult["warnings"] = {};

  const question = input.question.trim();
  if (question.length < 5) {
    errors.question = "Nội dung câu hỏi quá ngắn (tối thiểu 5 ký tự).";
  } else {
    const key = normalizeText(question);
    const dup = existing.find((q) => q.id !== editingId && normalizeText(q.question) === key);
    if (dup) warnings.question = "Cuộc thi này đã có một câu hỏi trùng nội dung.";
  }

  const points = Number(input.points ?? 1);
  if (!Number.isFinite(points) || points < 1) errors.points = "Điểm phải là số nguyên từ 1 trở lên.";

  if (input.time_limit_seconds !== undefined && input.time_limit_seconds !== null) {
    const raw = String(input.time_limit_seconds).trim();
    if (raw !== "") {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0)
        errors.time_limit_seconds = "Giới hạn thời gian phải là số giây không âm.";
      else if (n > MAX_TIME_LIMIT_SECONDS)
        errors.time_limit_seconds = `Giới hạn thời gian tối đa là ${MAX_TIME_LIMIT_SECONDS} giây.`;
    }
  }

  const options = trimmedOptions(input.options);
  const filled = options.filter(Boolean);

  switch (input.kind) {
    case "single":
    case "true_false": {
      if (filled.length < 2) errors.options = "Cần ít nhất 2 phương án có nội dung.";
      else if (options.some((o) => !o)) errors.options = "Có phương án đang để trống.";
      else if (hasDuplicate(options)) errors.options = "Các phương án bị trùng nội dung nhau.";
      if (
        input.correct_index === null ||
        input.correct_index === undefined ||
        input.correct_index < 0 ||
        input.correct_index >= options.length ||
        !options[input.correct_index]
      )
        errors.correct = "Phải chọn một phương án đúng.";
      break;
    }
    case "multi": {
      if (filled.length < 2) errors.options = "Cần ít nhất 2 phương án có nội dung.";
      else if (options.some((o) => !o)) errors.options = "Có phương án đang để trống.";
      else if (hasDuplicate(options)) errors.options = "Các phương án bị trùng nội dung nhau.";
      const picks = input.correct_indices ?? [];
      if (picks.length === 0) errors.correct = "Chọn ít nhất một đáp án đúng.";
      else if (filled.length >= 2 && picks.length === options.length)
        warnings.correct = "Bạn đang chọn ĐÚNG TẤT CẢ phương án — hãy kiểm tra lại.";
      break;
    }
    case "fill_blank": {
      const accepted = parseAcceptedAnswers(input.accepted_answers);
      if (accepted.length === 0) errors.accepted_answers = "Cần ít nhất một đáp án được chấp nhận.";
      else if (hasDuplicate(accepted))
        warnings.accepted_answers =
          "Có đáp án trùng nhau sau khi bỏ dấu và chữ hoa/thường — nên gộp lại.";
      break;
    }
    case "matching": {
      const pairs = (input.pairs ?? []).map((p) => ({
        left: p.left.trim(),
        right: p.right.trim(),
      }));
      if (pairs.length < 2) errors.pairs = "Câu nối cặp cần ít nhất 2 cặp.";
      else if (pairs.some((p) => !p.left || !p.right))
        errors.pairs = "Có cặp đang thiếu nội dung ở một vế.";
      else if (hasDuplicate(pairs.map((p) => p.right)))
        warnings.pairs = "Cột bên phải có giá trị trùng nhau — thí sinh có thể nối kiểu nào cũng đúng.";
      break;
    }
    case "ordering": {
      if (filled.length < 3) errors.options = "Câu sắp xếp cần ít nhất 3 mục.";
      else if (options.some((o) => !o)) errors.options = "Có mục đang để trống.";
      else if (hasDuplicate(options)) errors.options = "Các mục bị trùng nội dung nhau.";
      break;
    }
  }

  return { errors, warnings };
}

/** Có lỗi chặn lưu hay không. */
export function hasBlockingErrors(result: ValidationResult): boolean {
  return Object.keys(result.errors).length > 0;
}

/** Thông báo gộp ngắn gọn (dùng cho toast khi bấm Lưu mà còn lỗi). */
export function firstErrorMessage(result: ValidationResult): string | null {
  const values = Object.values(result.errors);
  return values.length ? (values[0] as string) : null;
}
