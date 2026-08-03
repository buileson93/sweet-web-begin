import { describe, expect, it } from "vitest";

import { speedrunPenalty } from "@/lib/integrity";

describe("speedrunPenalty", () => {
  it("không phạt bài làm với tốc độ bình thường", () => {
    expect(speedrunPenalty(145, 20)).toBe(0);
    expect(speedrunPenalty(60, 20)).toBe(0);
  });

  it("không phạt người thi RẤT nhanh nhưng vẫn khả thi", () => {
    expect(speedrunPenalty(50, 20)).toBe(0); // 2,5 giây/câu
    expect(speedrunPenalty(20, 20)).toBe(0); // 1 giây/câu
    expect(speedrunPenalty(16, 20)).toBe(0); // 0,8 giây/câu — đúng ngưỡng
  });

  it("không phạt bài quá ngắn (dưới 5 câu)", () => {
    expect(speedrunPenalty(1, 4)).toBe(0);
  });

  it("phạt nặng khi 20 câu nộp trong 4 giây", () => {
    expect(speedrunPenalty(4, 20)).toBeGreaterThanOrEqual(15);
  });
});
