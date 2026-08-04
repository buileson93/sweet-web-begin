import { describe, expect, it } from "vitest";
import { revealForCheck } from "./checkReveal";

describe("revealForCheck", () => {
  it("giữ đáp án đúng khi thí sinh trả lời đúng", () => {
    expect(revealForCheck({ correct: true, correctText: "B", explanation: "vì vậy" })).toEqual({
      correct: true,
      correctText: "B",
      explanation: "vì vậy",
    });
  });

  it("không lộ đáp án khi trả lời sai (chống thu hoạch qua nhiều lượt)", () => {
    const out = revealForCheck({ correct: false, correctText: "B", explanation: "" });
    expect(out.correct).toBe(false);
    expect(out.correctText).toBe("");
  });

  it("chuẩn hoá giải thích rỗng", () => {
    expect(revealForCheck({ correct: false, correctText: "B" }).explanation).toBe("");
    expect(revealForCheck({ correct: false, correctText: "B", explanation: null }).explanation).toBe("");
  });
});
