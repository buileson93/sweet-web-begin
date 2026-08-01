/**
 * Gói đề Leo Tháp — kiểu dữ liệu thuần, dùng chung cho máy chủ và trình duyệt.
 *
 * RANH GIỚI CỨNG: gói này CÓ đáp án đúng và CHỈ được nạp trong Leo Tháp.
 * Không import mô-đun này từ trang thi (`thi.tsx`) hay Đấu trường.
 */
import type { Difficulty, QuestionKind } from "@/lib/questionKinds";

export type BankQuestion = {
  id: string;
  kind: QuestionKind;
  question: string;
  options: string[];
  optionImages: string[];
  imageUrl: string | null;
  imageAlt: string;
  explanation: string;
  tags: string[];
  difficulty: Difficulty | string;
  /** Đáp án — chỉ có trong gói Leo Tháp. */
  answerIndex: number;
  answerIndices: number[];
  accepted: string[];
  pairs: { left: string; right: string }[];
  correctOrder: number[];
};

export type QuestionBank = {
  version: number;
  builtAt: string;
  questions: BankQuestion[];
};

/** Gói đã cũ khi thiếu, rỗng, hoặc lệch phiên bản so với máy chủ. */
export function bankIsStale(cached: QuestionBank | null, serverVersion: number): boolean {
  if (!cached || !cached.questions.length) return true;
  return cached.version !== serverVersion;
}

/** Mô tả đáp án đúng bằng chữ để hiện ở góc sửa lỗi. */
export function correctTextOfBank(q: BankQuestion): string {
  switch (q.kind) {
    case "multi":
      return q.answerIndices.map((i) => q.options[i] ?? "").filter(Boolean).join(" · ");
    case "fill_blank":
      return q.accepted[0] ?? "";
    case "matching":
      return q.pairs.map((p) => `${p.left} → ${p.right}`).join(" · ");
    case "ordering":
      return q.correctOrder.map((i) => q.options[i] ?? "").filter(Boolean).join(" → ");
    default:
      return q.options[q.answerIndex] ?? "";
  }
}
