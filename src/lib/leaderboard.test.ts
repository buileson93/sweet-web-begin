import { describe, expect, it } from "vitest";

import { accuracyOf, bonusRatioOf, isRankable, rankResults, rankUniqueResults } from "@/lib/leaderboard";

const thao = { candidate_name: "Thảo", score: 19, total: 20, points: 19, max_points: 0, time_seconds: 206 };
const tho = { candidate_name: "Thọ", score: 12, total: 20, points: 40, max_points: 20, time_seconds: 177 };

describe("rankResults", () => {
  it("người đúng nhiều câu hơn phải đứng trên dù điểm thưởng thấp hơn", () => {
    expect(rankResults([tho, thao]).map((r) => r.candidate_name)).toEqual(["Thảo", "Thọ"]);
  });

  it("cùng tỉ lệ đúng thì ai nhanh hơn đứng trên, điểm thưởng không tính", () => {
    const a = { candidate_name: "A", score: 16, total: 20, points: 16, max_points: 40, time_seconds: 100 };
    const b = { candidate_name: "B", score: 16, total: 20, points: 32, max_points: 40, time_seconds: 300 };
    expect(rankResults([a, b]).map((r) => r.candidate_name)).toEqual(["A", "B"]);
  });

  it("cùng tỉ lệ đúng và thưởng thì ai nhanh hơn đứng trên", () => {
    const a = { candidate_name: "A", score: 18, total: 20, points: 0, max_points: 0, time_seconds: 500 };
    const b = { candidate_name: "B", score: 18, total: 20, points: 0, max_points: 0, time_seconds: 120 };
    expect(rankResults([a, b]).map((r) => r.candidate_name)).toEqual(["B", "A"]);
  });

  it("loại bài dưới 50% khỏi bảng xếp hạng", () => {
    const rot = { candidate_name: "Rớt", score: 9, total: 20, points: 200, max_points: 20, time_seconds: 60 };
    expect(rankResults([rot, thao]).map((r) => r.candidate_name)).toEqual(["Thảo"]);
    expect(isRankable(rot)).toBe(false);
  });

  it("tổng số câu bằng 0 thì không tính và không chia cho 0", () => {
    const empty = { score: 0, total: 0, points: 5, max_points: 0, time_seconds: 10 };
    expect(accuracyOf(empty)).toBe(0);
    expect(bonusRatioOf(empty)).toBe(0);
    expect(rankResults([empty])).toEqual([]);
  });
});

describe("rankUniqueResults", () => {
  it("mỗi thí sinh chỉ hiện bài tốt nhất", () => {
    const rows = [
      { candidate_name: "A", unit: "Đài 1", score: 15, total: 20, time_seconds: 100 },
      { candidate_name: "A", unit: "Đài 1", score: 19, total: 20, time_seconds: 120 },
      { candidate_name: "B", unit: "Đài 2", score: 17, total: 20, time_seconds: 90 },
    ];
    const out = rankUniqueResults(rows);
    expect(out.map((r) => `${r.candidate_name}-${r.score}`)).toEqual(["A-19", "B-17"]);
  });
});

describe("phá hoà theo số lần thi", () => {
  it("cùng tỉ lệ đúng và cùng thời gian thì ai thi ít lần hơn xếp trên", () => {
    const rows = [
      { candidate_name: "Nhiều", unit: "Đài 1", score: 12, total: 20, time_seconds: 300 },
      { candidate_name: "Nhiều", unit: "Đài 1", score: 18, total: 20, time_seconds: 150 },
      { candidate_name: "Ít", unit: "Đài 2", score: 18, total: 20, time_seconds: 150 },
    ];
    expect(rankUniqueResults(rows).map((r) => r.candidate_name)).toEqual(["Ít", "Nhiều"]);
  });
});
