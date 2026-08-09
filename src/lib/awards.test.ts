import { describe, expect, it } from "vitest";

import { computeAwards, passedRows, percentOfRow, type AwardRow } from "@/lib/awards";

function row(p: Partial<AwardRow> & { id: string }): AwardRow {
  return {
    candidate_name: "Nguyễn Văn A",
    unit: "Đài KSKL Đà Nẵng",
    score: 10,
    total: 20,
    time_seconds: 600,
    points: 10,
    best_streak: 3,
    submitted_at: "2026-07-01T00:00:00.000Z",
    ...p,
  };
}

describe("percentOfRow", () => {
  it("trả 0 khi tổng số câu bằng 0", () => {
    expect(percentOfRow({ score: 5, total: 0 })).toBe(0);
  });
  it("làm tròn phần trăm", () => {
    expect(percentOfRow({ score: 1, total: 3 })).toBe(33);
  });
});

describe("passedRows", () => {
  it("loại bài dưới 50%", () => {
    const rows = [row({ id: "a", score: 9, total: 20 }), row({ id: "b", score: 10, total: 20 })];
    expect(passedRows(rows).map((r) => r.id)).toEqual(["b"]);
  });
});

describe("computeAwards", () => {
  it("không có bài đạt thì không có giải nào", () => {
    expect(computeAwards([row({ id: "a", score: 1, total: 20 })])).toEqual([]);
  });

  it("chọn nhà vô địch theo điểm rồi tới thời gian", () => {
    const winners = computeAwards([
      row({ id: "a", score: 18, total: 20, time_seconds: 500 }),
      row({ id: "b", score: 18, total: 20, time_seconds: 300, candidate_name: "Trần B" }),
    ]);
    const champion = winners.find((w) => w.key === "champion");
    expect(champion?.name).toBe("Trần B");
  });

  it("vinh danh combo dài nhất", () => {
    const winners = computeAwards([
      row({ id: "a", score: 15, total: 20, best_streak: 4 }),
      row({ id: "b", score: 15, total: 20, best_streak: 11, candidate_name: "Lê C" }),
    ]);
    expect(winners.find((w) => w.key === "streak")).toMatchObject({
      name: "Lê C",
      value: "11 câu liên tiếp",
    });
  });

  it("đếm số lượt thi kể cả bài chưa đạt", () => {
    const winners = computeAwards([
      row({ id: "a", score: 15, total: 20 }),
      row({ id: "b", score: 2, total: 20 }),
      row({ id: "c", score: 3, total: 20 }),
      row({ id: "d", score: 16, total: 20, candidate_name: "Phạm D" }),
    ]);
    expect(winners.find((w) => w.key === "diligent")).toMatchObject({ raw: 3 });
  });

  it("bỏ giải chăm chỉ khi ai cũng chỉ thi một lần", () => {
    const winners = computeAwards([
      row({ id: "a", score: 15, total: 20 }),
      row({ id: "b", score: 16, total: 20, candidate_name: "Phạm D" }),
    ]);
    expect(winners.some((w) => w.key === "diligent")).toBe(false);
  });

  it("tính tiến bộ vượt bậc theo lượt đầu và lượt tốt nhất", () => {
    const winners = computeAwards([
      row({ id: "a", score: 4, total: 20, submitted_at: "2026-07-01T00:00:00.000Z" }),
      row({ id: "b", score: 18, total: 20, submitted_at: "2026-07-02T00:00:00.000Z" }),
    ]);
    expect(winners.find((w) => w.key === "progress")).toMatchObject({ value: "+70%" });
  });

  it("chọn người hoàn thành nhanh nhất trong các bài đạt", () => {
    const winners = computeAwards([
      row({ id: "a", score: 15, total: 20, time_seconds: 900 }),
      row({ id: "b", score: 15, total: 20, time_seconds: 240, candidate_name: "Võ E" }),
    ]);
    expect(winners.find((w) => w.key === "speed")).toMatchObject({ name: "Võ E", value: "04:00.000" });
  });
});
