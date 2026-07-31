import { describe, expect, it } from "vitest";

import { analyzeQuizHealth, overlapPercentOf, summarizePool } from "@/lib/quizHealth";

const pool = (n: number, extra: Partial<ReturnType<typeof summarizePool>> = {}) => ({
  total: n,
  easy: 0,
  medium: n,
  hard: 0,
  tags: {},
  ...extra,
});

describe("summarizePool", () => {
  it("đếm theo độ khó và theo thẻ", () => {
    const stats = summarizePool([
      { difficulty: "easy", tags: ["an toàn", "quy chế"] },
      { difficulty: "hard", tags: ["an toàn"] },
      { difficulty: "medium", tags: null },
    ]);
    expect(stats.total).toBe(3);
    expect(stats.easy).toBe(1);
    expect(stats.hard).toBe(1);
    expect(stats.tags["an toàn"]).toBe(2);
    expect(stats.tags["quy chế"]).toBe(1);
  });
});

describe("overlapPercentOf", () => {
  it("kho rỗng coi như trùng hoàn toàn", () => {
    expect(overlapPercentOf(20, 0)).toBe(100);
  });
  it("tính theo tỉ lệ số câu / kho", () => {
    expect(overlapPercentOf(20, 100)).toBe(20);
    expect(overlapPercentOf(20, 20)).toBe(100);
  });
});

describe("analyzeQuizHealth", () => {
  it("báo ĐỎ khi kho ít hơn số câu yêu cầu", () => {
    const r = analyzeQuizHealth({ questionCount: 30, blueprint: {}, pool: pool(10) });
    expect(r.hasBlocker).toBe(true);
    expect(r.issues.some((i) => i.level === "red")).toBe(true);
  });

  it("không chặn khi kho đủ", () => {
    const r = analyzeQuizHealth({ questionCount: 20, blueprint: {}, pool: pool(200) });
    expect(r.hasBlocker).toBe(false);
  });

  it("cảnh báo VÀNG khi blueprint vượt số câu có ở một mức độ khó", () => {
    const r = analyzeQuizHealth({
      questionCount: 10,
      blueprint: { easy: 8, medium: 2 },
      pool: pool(100, { easy: 3, medium: 97 }),
    });
    expect(r.hasBlocker).toBe(false);
    expect(r.issues.some((i) => i.level === "yellow" && i.message.includes("Dễ"))).toBe(true);
  });

  it("cảnh báo khi tổng blueprint khác số câu mỗi lượt", () => {
    const r = analyzeQuizHealth({
      questionCount: 20,
      blueprint: { easy: 5, medium: 5 },
      pool: pool(200, { easy: 100, medium: 100 }),
    });
    expect(r.blueprintTotal).toBe(10);
    expect(r.issues.some((i) => i.message.includes("ít hơn số câu"))).toBe(true);
  });

  it("tính cả blueprint theo thẻ", () => {
    const r = analyzeQuizHealth({
      questionCount: 5,
      blueprint: { tags: { "an toàn": 5 } },
      pool: pool(100, { tags: { "an toàn": 2 } }),
    });
    expect(r.blueprintTotal).toBe(5);
    expect(r.issues.some((i) => i.message.includes('Thẻ "an toàn"'))).toBe(true);
  });

  it("cảnh báo khi tỉ lệ trùng đề cao", () => {
    const r = analyzeQuizHealth({ questionCount: 20, blueprint: {}, pool: pool(25) });
    expect(r.overlapPercent).toBe(80);
    expect(r.issues.some((i) => i.level === "yellow" && i.message.includes("trùng khoảng"))).toBe(true);
  });
});
