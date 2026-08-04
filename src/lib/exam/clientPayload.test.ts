import { describe, expect, it } from "vitest";

import {
  checkVerdict,
  findLeakedFields,
  sanitizeExamQuestion,
} from "@/lib/exam/clientPayload";
import type { ExamQuestion } from "@/lib/exam/types";

const base: ExamQuestion = {
  id: "q1",
  kind: "single",
  question: "1 + 1 = ?",
  options: ["1", "2", "3", "4"],
  matchLeft: [],
  optionImages: ["", "", "", ""],
  imageUrl: null,
  imageAlt: "",
  points: 1,
  difficulty: "easy",
  timeLimitSeconds: null,
};

describe("gói đề gửi xuống máy khách", () => {
  it("loại bỏ mọi trường đáp án bị lẫn vào", () => {
    const dirty = {
      ...base,
      correct_index: 1,
      explanation: "vì 1+1=2",
      accepted_answers: ["2"],
    } as unknown as ExamQuestion;
    const clean = sanitizeExamQuestion(dirty);
    expect(findLeakedFields(clean)).toEqual([]);
    expect(clean.options).toEqual(base.options);
  });

  it("phát hiện đáp án lọt xuống ở mọi độ sâu", () => {
    expect(findLeakedFields({ questions: [{ ...base, correctIndex: 2 }] })).toContain(
      "correctIndex",
    );
    expect(findLeakedFields({ questions: [base] })).toEqual([]);
  });

  it("chấm ngay chỉ trả về đúng/sai", () => {
    expect(checkVerdict(true)).toEqual({ correct: true });
    expect(findLeakedFields(checkVerdict(false))).toEqual([]);
  });
});
