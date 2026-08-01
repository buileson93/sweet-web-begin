/**
 * Chấm bài PHÍA MÁY NGƯỜI DÙNG — chỉ dùng cho Leo Tháp.
 *
 * RANH GIỚI CỨNG: mã này KHÔNG dùng chung với kỳ thi hay Đấu trường. Hai nơi đó
 * vẫn chấm ở máy chủ bằng `src/lib/grading.ts`. Sửa tệp này không được phép
 * ảnh hưởng tới hai đường dẫn kia.
 *
 * Câu hỏi ở đây đã được xáo sẵn nên đáp án nằm đúng trong không gian hiển thị:
 * không cần bảng ánh xạ thứ tự.
 */
import type { AnswerValue } from "@/lib/questionKinds";
import type { BankQuestion } from "@/lib/tower/bank";

/** Bỏ dấu, hạ chữ thường, gom khoảng trắng — so khớp mềm cho câu điền. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Khoảng cách Levenshtein — cho phép gõ sai 1 ký tự với đáp án dài. */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i, ...Array<number>(n).fill(0)];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = cur;
  }
  return prev[n]!;
}

function fillMatches(input: string, accepted: string[]): boolean {
  const value = normalizeText(input);
  if (!value) return false;
  return accepted.some((raw) => {
    const target = normalizeText(raw);
    if (!target) return false;
    if (value === target) return true;
    const tolerance = target.length >= 8 ? 1 : 0;
    return tolerance > 0 && editDistance(value, target) <= tolerance;
  });
}

/** Điểm phần 0…1 cho một câu (câu nhiều đáp án được chấm từng phần). */
export function gradeLocal(question: BankQuestion, value: AnswerValue | undefined): number {
  if (value === undefined || value === null || value === "") return 0;

  switch (question.kind) {
    case "multi": {
      if (!Array.isArray(value)) return 0;
      const expected = new Set(question.answerIndices);
      if (!expected.size) return 0;
      const chosen = new Set(value.filter((i) => Number.isInteger(i)));
      let hit = 0;
      let wrong = 0;
      for (const i of chosen) (expected.has(i) ? hit++ : wrong++);
      const score = (hit - wrong) / expected.size;
      return Math.max(0, Math.min(1, score));
    }
    case "fill_blank":
      return typeof value === "string" && fillMatches(value, question.accepted) ? 1 : 0;
    case "matching": {
      if (typeof value !== "object" || Array.isArray(value)) return 0;
      const pairs = question.pairs;
      if (!pairs.length) return 0;
      const map = value as Record<string, number>;
      const ok = pairs.every((_, left) => map[String(left)] === left);
      return ok ? 1 : 0;
    }
    case "ordering": {
      if (!Array.isArray(value)) return 0;
      const expected = question.correctOrder.length
        ? question.correctOrder
        : question.options.map((_, i) => i);
      if (value.length !== expected.length) return 0;
      return value.every((v, i) => v === expected[i]) ? 1 : 0;
    }
    default:
      return typeof value === "number" && value === question.answerIndex ? 1 : 0;
  }
}
