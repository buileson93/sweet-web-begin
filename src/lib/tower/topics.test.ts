import { describe, expect, it } from "vitest";

import {
  accumulateTopics,
  adaptiveScore,
  expectedScore,
  kFactor,
  masteryOf,
  nextRating,
  pickAdaptive,
  readinessPercent,
  START_RATING,
} from "./topics";

describe("expectedScore", () => {
  it("ngang cơ thì 50%", () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 5);
  });
  it("giỏi hơn thì xác suất cao hơn", () => {
    expect(expectedScore(1400, 1200)).toBeGreaterThan(0.7);
    expect(expectedScore(1000, 1400)).toBeLessThan(0.15);
  });
});

describe("kFactor", () => {
  it("giảm dần theo kinh nghiệm", () => {
    expect(kFactor(0)).toBe(40);
    expect(kFactor(15)).toBe(24);
    expect(kFactor(100)).toBe(16);
  });
});

describe("nextRating", () => {
  it("đúng thì tăng, sai thì giảm", () => {
    expect(nextRating({ rating: 1200, games: 0, difficulty: "medium", score: 1 })).toBeGreaterThan(1200);
    expect(nextRating({ rating: 1200, games: 0, difficulty: "medium", score: 0 })).toBeLessThan(1200);
  });
  it("thắng câu khó tăng nhiều hơn thắng câu dễ", () => {
    const hard = nextRating({ rating: 1200, games: 0, difficulty: "hard", score: 1 });
    const easy = nextRating({ rating: 1200, games: 0, difficulty: "easy", score: 1 });
    expect(hard).toBeGreaterThan(easy);
  });
  it("điểm phần nằm giữa", () => {
    const half = nextRating({ rating: 1200, games: 0, difficulty: "medium", score: 0.5 });
    expect(half).toBe(1200);
  });
  it("kẹp điểm ngoài khoảng", () => {
    expect(nextRating({ rating: 1200, games: 0, difficulty: "medium", score: 5 })).toBe(
      nextRating({ rating: 1200, games: 0, difficulty: "medium", score: 1 }),
    );
  });
});

describe("accumulateTopics", () => {
  it("cập nhật từng thẻ chủ đề của một câu", () => {
    const out = accumulateTopics({}, [
      { tags: ["khong-luu", "an-toan"], difficulty: "medium", fraction: 1 },
    ]);
    expect(out.map((t) => t.tag).sort()).toEqual(["an-toan", "khong-luu"]);
    expect(out[0]!.games).toBe(1);
    expect(out[0]!.correct).toBe(1);
  });

  it("gộp nhiều câu cùng chủ đề trong một chặng", () => {
    const out = accumulateTopics({}, [
      { tags: ["a"], difficulty: "easy", fraction: 1 },
      { tags: ["a"], difficulty: "easy", fraction: 0 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.games).toBe(2);
    expect(out[0]!.correct).toBe(1);
  });

  it("bỏ qua thẻ rỗng và nối tiếp điểm hiện có", () => {
    const out = accumulateTopics({ a: { rating: 1300, games: 5, correct: 4 } }, [
      { tags: ["a", " "], difficulty: "medium", fraction: 1 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.rating).toBeGreaterThan(1300);
    expect(out[0]!.games).toBe(6);
  });

  it("không có thẻ nào thì không tạo bản ghi", () => {
    expect(accumulateTopics({}, [{ tags: [], difficulty: "hard", fraction: 1 }])).toEqual([]);
  });
});

describe("masteryOf", () => {
  it("chưa đủ lần gặp thì chưa kết luận", () => {
    expect(masteryOf(1600, 2)).toBe("moi");
  });
  it("phân mức theo điểm", () => {
    expect(masteryOf(1450, 10)).toBe("thanh-thao");
    expect(masteryOf(1300, 10)).toBe("kha");
    expect(masteryOf(1100, 10)).toBe("dang-hoc");
  });
});

describe("chọn câu thích ứng", () => {
  it("ưu tiên câu có xác suất đúng gần 0,8", () => {
    const ratings = { a: { rating: 1200, games: 10 } };
    const easy = adaptiveScore({ tags: ["a"], difficulty: "easy" }, ratings);
    const hard = adaptiveScore({ tags: ["a"], difficulty: "hard" }, ratings);
    expect(easy).toBeLessThan(hard);
  });

  it("chủ đề chưa có điểm dùng mức khởi đầu", () => {
    expect(adaptiveScore({ tags: ["moi"], difficulty: "medium" }, {})).toBeCloseTo(0.3, 5);
  });

  it("pickAdaptive trả đúng số lượng và theo thứ tự phù hợp", () => {
    const qs = [
      { id: "h", tags: ["a"], difficulty: "hard" },
      { id: "e", tags: ["a"], difficulty: "easy" },
      { id: "m", tags: ["a"], difficulty: "medium" },
    ];
    const out = pickAdaptive(qs, { a: { rating: START_RATING, games: 5 } }, 2);
    expect(out).toHaveLength(2);
    expect(out[0]!.id).toBe("e");
  });
});

describe("readinessPercent", () => {
  it("không có dữ liệu thì 0", () => {
    expect(readinessPercent([])).toBe(0);
  });
  it("điểm cao hơn cho dự báo cao hơn", () => {
    expect(readinessPercent([{ rating: 1500, games: 10 }])).toBeGreaterThan(
      readinessPercent([{ rating: 1100, games: 10 }]),
    );
  });
  it("luôn trong khoảng 0–100", () => {
    const v = readinessPercent([
      { rating: 2000, games: 3 },
      { rating: 800, games: 3 },
    ]);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
  });
});
