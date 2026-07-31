/**
 * Bộ phân tích văn bản đề thi soạn bằng Word (.docx).
 *
 * Đây là HÀM THUẦN: nhận vào văn bản đã chuẩn hoá (mỗi dòng một đoạn) và trả
 * về danh sách câu hỏi. Nhờ vậy có thể kiểm thử mà không cần trình duyệt.
 *
 * Quy ước văn bản đầu vào (do lớp đọc .docx sinh ra):
 * - Phần chữ IN ĐẬM được bọc trong cặp dấu `**`.
 * - Ảnh nhúng trở thành một dòng riêng `[[IMG:n]]` với n là chỉ số ảnh.
 */

export type ParsedQuestion = {
  /** Số thứ tự ghi trong tệp (nếu có). */
  number: number | null;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  /** Chỉ số ảnh minh hoạ cho câu hỏi (theo thứ tự xuất hiện trong tệp). */
  imageRef: number | null;
  /** Chỉ số ảnh cho từng phương án, null nếu phương án không có ảnh. */
  optionImageRefs: (number | null)[];
};

const RE_QUESTION = /^(?:câu|cau|question|q)\s*(\d+)\s*[.:)\-]?\s*(.*)$/i;
const RE_OPTION = /^(\*|\+)?\s*([a-dA-D])\s*[.):\-]\s*(.*)$/;
const RE_ANSWER =
  /^(?:đáp\s*án|dap\s*an|đ\.?a|d\.?a|answer|ans|key)\s*(?:đúng|dung)?\s*[:.\-)]?\s*([a-dA-D])\b/i;
const RE_EXPLAIN = /^(?:giải\s*thích|giai\s*thich|explanation|hướng\s*dẫn|huong\s*dan)\s*[:.\-]?\s*(.*)$/i;
const RE_IMAGE = /^\[\[IMG:(\d+)\]\]$/;

/** Bỏ dấu ** đánh dấu in đậm, trả về chuỗi sạch. */
export function stripBold(text: string): string {
  return text.replace(/\*\*/g, "").trim();
}

/** Một chuỗi có được in đậm toàn bộ (hoặc phần lớn) hay không. */
export function isBold(text: string): boolean {
  return /\*\*[^*]+\*\*/.test(text);
}

type Draft = {
  number: number | null;
  questionParts: string[];
  options: { text: string; bold: boolean; marked: boolean; image: number | null }[];
  answerLetter: string | null;
  explanation: string[];
  imageRef: number | null;
};

function newDraft(number: number | null, first: string): Draft {
  return {
    number,
    questionParts: first ? [first] : [],
    options: [],
    answerLetter: null,
    explanation: [],
    imageRef: null,
  };
}

function finalize(d: Draft): ParsedQuestion | null {
  const question = stripBold(d.questionParts.join(" ")).replace(/\s+/g, " ").trim();
  const options = d.options.map((o) => stripBold(o.text));
  if (!question || options.length < 2) return null;

  let correct = -1;
  if (d.answerLetter) correct = d.answerLetter.toUpperCase().charCodeAt(0) - 65;
  if (correct < 0 || correct >= options.length) correct = d.options.findIndex((o) => o.marked);
  if (correct < 0) {
    // In đậm phương án đúng — chỉ chấp nhận khi DUY NHẤT một phương án in đậm.
    const bolds = d.options.map((o, i) => (o.bold ? i : -1)).filter((i) => i >= 0);
    correct = bolds.length === 1 ? bolds[0] : -1;
  }

  return {
    number: d.number,
    question,
    options,
    correct_index: correct,
    explanation: stripBold(d.explanation.join(" ")).trim(),
    imageRef: d.imageRef,
    optionImageRefs: d.options.map((o) => o.image),
  };
}

/**
 * Phân tích toàn bộ văn bản đề thi.
 * Dòng không khớp mẫu nào sẽ được nối tiếp vào phần đang dở (câu hỏi / phương
 * án / giải thích) để không mất nội dung xuống dòng.
 */
export function parseDocxQuestions(text: string): ParsedQuestion[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00a0/g, " ").trim())
    .filter((l) => l.length > 0);

  const out: ParsedQuestion[] = [];
  let draft: Draft | null = null;
  let cursor: "question" | "option" | "explain" = "question";

  const push = () => {
    if (!draft) return;
    const q = finalize(draft);
    if (q) out.push(q);
    draft = null;
  };

  for (const line of lines) {
    const img = RE_IMAGE.exec(line);
    if (img) {
      const n = Number(img[1]);
      if (draft) {
        if (cursor === "option" && draft.options.length > 0)
          draft.options[draft.options.length - 1].image = n;
        else if (draft.imageRef === null) draft.imageRef = n;
      }
      continue;
    }

    const mq = RE_QUESTION.exec(stripBold(line));
    if (mq) {
      push();
      draft = newDraft(Number(mq[1]), mq[2]);
      cursor = "question";
      continue;
    }

    if (!draft) continue;

    const ma = RE_ANSWER.exec(stripBold(line));
    if (ma) {
      draft.answerLetter = ma[1];
      cursor = "explain";
      continue;
    }

    const me = RE_EXPLAIN.exec(stripBold(line));
    if (me) {
      if (me[1]) draft.explanation.push(me[1]);
      cursor = "explain";
      continue;
    }

    const mo = RE_OPTION.exec(line.replace(/^\*\*(\*?\s*[a-dA-D]\s*[.):\-])/, "$1**"));
    if (mo) {
      draft.options.push({
        text: mo[3],
        bold: isBold(mo[3]) || isBold(line),
        marked: mo[1] === "*" || mo[1] === "+",
        image: null,
      });
      cursor = "option";
      continue;
    }

    if (cursor === "question") draft.questionParts.push(line);
    else if (cursor === "option" && draft.options.length > 0)
      draft.options[draft.options.length - 1].text += ` ${line}`;
    else draft.explanation.push(line);
  }
  push();
  return out;
}
