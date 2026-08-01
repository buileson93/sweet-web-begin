import { describe, expect, it } from "vitest";

import { realDifficultyOf } from "./questionInsights";

describe("realDifficultyOf", () => {
  it("chưa đủ dữ liệu khi dưới 5 lượt làm", () => {
    expect(realDifficultyOf(0, 0)).toBe("unknown");
    expect(realDifficultyOf(4, 100)).toBe("unknown");
  });

  it("phân loại theo tỉ lệ đúng", () => {
    expect(realDifficultyOf(10, 90)).toBe("easy");
    expect(realDifficultyOf(10, 80)).toBe("easy");
    expect(realDifficultyOf(10, 79)).toBe("medium");
    expect(realDifficultyOf(10, 50)).toBe("medium");
    expect(realDifficultyOf(10, 49)).toBe("hard");
    expect(realDifficultyOf(10, 0)).toBe("hard");
  });
});

describe("questionQualityFlags", () => {
  it("chưa đủ lượt làm thì không gắn cờ", () => {
    expect(questionQualityFlags({ attempts: 10, correct: 10, blank: 0 })).toEqual([]);
  });

  it("tỉ lệ đúng trên 95% là câu quá dễ", () => {
    const flags = questionQualityFlags({ attempts: 100, correct: 98, blank: 0 });
    expect(flags.map((f) => f.code)).toEqual(["too_easy"]);
  });

  it("tỉ lệ đúng dưới 15% là nghi sai đáp án", () => {
    const flags = questionQualityFlags({ attempts: 100, correct: 9, blank: 0 });
    expect(flags[0].code).toBe("suspect_answer");
    expect(flags[0].tone).toBe("danger");
  });

  it("bỏ trống từ 30% trở lên là câu tối nghĩa", () => {
    const flags = questionQualityFlags({ attempts: 100, correct: 50, blank: 35 });
    expect(flags.map((f) => f.code)).toEqual(["high_blank"]);
  });

  it("một câu có thể dính nhiều cờ cùng lúc", () => {
    const flags = questionQualityFlags({ attempts: 50, correct: 5, blank: 20 });
    expect(flags.map((f) => f.code)).toEqual(["suspect_answer", "high_blank"]);
  });

  it("câu ở mức bình thường không bị gắn cờ", () => {
    expect(questionQualityFlags({ attempts: 100, correct: 60, blank: 5 })).toEqual([]);
  });
});
