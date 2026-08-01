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
