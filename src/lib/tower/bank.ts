/**
 * Gói đề Leo Tháp — kiểu dữ liệu thuần, dùng chung cho máy chủ và trình duyệt.
 *
 * RANH GIỚI CỨNG: gói này CÓ đáp án đúng và CHỈ được nạp trong Leo Tháp.
 * Không import mô-đun này từ trang thi (`thi.tsx`) hay Đấu trường.
 */
import type { Difficulty, QuestionKind } from "@/lib/questionKinds";

export type BankQuestion = {
  id: string;
  /** Bộ đề chứa câu hỏi — cho phép chọn nhiều bộ đề khi vào ca trực. */
  quizId: string;
  quizTitle: string;
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

export type BankQuizInfo = { id: string; title: string; count: number };

export type QuestionBank = {
  version: number;
  builtAt: string;
  questions: BankQuestion[];
  /** Danh mục bộ đề có trong gói (đã đếm sẵn số câu). */
  quizzes?: BankQuizInfo[];
};

/** Gom danh mục bộ đề từ gói đã tải (dùng khi gói cũ chưa có sẵn danh mục). */
export function bankQuizzes(bank: QuestionBank | null): BankQuizInfo[] {
  if (!bank) return [];
  if (bank.quizzes?.length) return bank.quizzes;
  const map = new Map<string, BankQuizInfo>();
  for (const q of bank.questions) {
    if (!q.quizId) continue;
    const cur = map.get(q.quizId);
    if (cur) cur.count += 1;
    else map.set(q.quizId, { id: q.quizId, title: q.quizTitle || "Bộ đề", count: 1 });
  }
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title, "vi"));
}

/** Lọc gói theo các bộ đề đã chọn; không chọn gì thì dùng cả gói. */
export function filterBankByQuizzes(bank: QuestionBank, quizIds: string[]): QuestionBank {
  if (!quizIds.length) return bank;
  const set = new Set(quizIds);
  return { ...bank, questions: bank.questions.filter((q) => set.has(q.quizId)) };
}

/** Gói đã cũ khi thiếu, rỗng, hoặc lệch phiên bản so với máy chủ. */
export function bankIsStale(cached: QuestionBank | null, serverVersion: number): boolean {
  if (!cached || !cached.questions.length) return true;
  // Gói cũ chưa gắn bộ đề thì phải tải lại để chọn được nhiều bộ đề.
  if (!cached.questions[0]?.quizId) return true;
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
