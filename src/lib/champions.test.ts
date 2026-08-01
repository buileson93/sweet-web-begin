import { describe, expect, it } from "vitest";

import { basePointsOf, isChampionEligible, rankChampions, type ChampionRow } from "@/lib/champions";

function row(p: Partial<ChampionRow> & { id: string }): ChampionRow {
  return {
    candidate_name: `TS ${p.id}`,
    unit: "Đài A",
    score: 18,
    total: 20,
    points: 100,
    max_points: 100,
    best_streak: 5,
    time_seconds: 300,
    submitted_at: "2026-01-01T00:00:00.000Z",
    ...p,
  };
}

describe("champions", () => {
  it("loại bài dưới 50%", () => {
    expect(isChampionEligible(row({ id: "a", score: 9, total: 20 }))).toBe(false);
    expect(isChampionEligible(row({ id: "b", score: 10, total: 20 }))).toBe(true);
  });

  it("tính điểm nền theo tỉ lệ đúng", () => {
    expect(basePointsOf(row({ id: "a", score: 10, total: 20, max_points: 200 }))).toBe(100);
    expect(basePointsOf(row({ id: "b", max_points: 0 }))).toBe(0);
  });

  it("xếp theo điểm thưởng rồi tới chuỗi dài nhất", () => {
    const out = rankChampions([
      row({ id: "ít-thưởng", candidate_name: "A", points: 95, max_points: 100, score: 19, total: 20, best_streak: 3 }),
      row({ id: "nhiều-thưởng", candidate_name: "B", points: 150, max_points: 100, score: 18, total: 20, best_streak: 12 }),
    ]);
    expect(out.map((r) => r.candidate_name)).toEqual(["B", "A"]);
    expect(out[0]!.bonusPoints).toBe(60);
  });

  it("mỗi thí sinh chỉ giữ bài tốt nhất và tôn trọng giới hạn", () => {
    const out = rankChampions(
      [
        row({ id: "1", candidate_name: "A", points: 200 }),
        row({ id: "2", candidate_name: "A", points: 120 }),
        row({ id: "3", candidate_name: "C", points: 110 }),
      ],
      2,
    );
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.id)).toEqual(["1", "3"]);
  });
});
