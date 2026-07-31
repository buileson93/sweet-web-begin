import { describe, expect, it } from "vitest";

import { FORBIDDEN_KEYS, buildRoundPayload } from "./payload";
import type { QuestionRow } from "@/lib/grading";

const row: QuestionRow = {
  id: "q1",
  question: "Sân bay Đà Nẵng có mã IATA là gì?",
  options: ["DAD", "HAN", "SGN", "CXR"],
  correct_index: 0,
  image_url: null,
  option_images: [],
  kind: "single",
  correct_indices: [0],
  accepted_answers: ["DAD"],
  pairs: [{ left: "Đà Nẵng", right: "DAD" }],
  correct_order: [0, 1, 2, 3],
  difficulty: "easy",
  tags: [],
  points: 10,
  explanation: "DAD là mã sân bay Đà Nẵng.",
  time_limit_seconds: null,
  order_index: 0,
} as unknown as QuestionRow;

describe("buildRoundPayload", () => {
  it("hoán vị phương án theo thứ tự đã trộn", () => {
    const payload = buildRoundPayload(row, [2, 0, 3, 1], 0);
    expect(payload.options).toEqual(["SGN", "DAD", "CXR", "HAN"]);
    expect(payload.index).toBe(0);
  });

  it("KHÔNG rò rỉ bất kỳ trường đáp án nào", () => {
    const json = JSON.stringify(buildRoundPayload(row, [0, 1, 2, 3], 3));
    for (const key of FORBIDDEN_KEYS) expect(json).not.toContain(key);
    expect(json).not.toContain("explanation");
    expect(Object.keys(buildRoundPayload(row, [0, 1, 2, 3], 0))).toEqual([
      "index",
      "kind",
      "question",
      "options",
      "optionImages",
      "matchLeft",
      "imageUrl",
    ]);
  });

  it("câu nối cặp chỉ phát cột trái", () => {
    const matching = { ...row, kind: "matching" } as QuestionRow;
    expect(buildRoundPayload(matching, [0], 0).matchLeft).toEqual(["Đà Nẵng"]);
  });
});
