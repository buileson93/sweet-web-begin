import { describe, expect, it } from "vitest";

import { buildReviewRows } from "./log";

describe("buildReviewRows", () => {
  it("không tạo dòng khi thiếu nhân viên", () => {
    expect(buildReviewRows(null, "exam", [{ id: "a", fraction: 1, answered: true }])).toEqual([]);
  });

  it("mảng rỗng trả về mảng rỗng", () => {
    expect(buildReviewRows("e1", "exam", [])).toEqual([]);
  });

  it("câu bỏ trống không tính là đúng", () => {
    const [row] = buildReviewRows("e1", "exam", [{ id: "q1", fraction: 0, answered: false }]);
    expect(row?.correct).toBe(false);
    expect(row?.fraction).toBe(0);
  });

  it("câu đúng một phần giữ nguyên tỉ lệ và không tính là đúng", () => {
    const [row] = buildReviewRows("e1", "tower", [{ id: "q1", fraction: 0.5, answered: true }]);
    expect(row?.correct).toBe(false);
    expect(row?.fraction).toBe(0.5);
    expect(row?.mode).toBe("tower");
  });

  it("kẹp tỉ lệ về khoảng 0–1 và làm tròn thời gian", () => {
    const [row] = buildReviewRows("e1", "duel", [
      { id: "q1", fraction: 1.4, answered: true, msTaken: 12.6 },
    ]);
    expect(row?.fraction).toBe(1);
    expect(row?.correct).toBe(true);
    expect(row?.ms_taken).toBe(13);
  });

  it("bỏ qua mục thiếu id", () => {
    expect(
      buildReviewRows("e1", "exam", [{ id: "", fraction: 1, answered: true }]),
    ).toHaveLength(0);
  });
});
