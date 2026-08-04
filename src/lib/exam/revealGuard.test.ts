import { describe, expect, it } from "vitest";
import { excludeRevealed, revealedFromSessions } from "@/lib/exam/revealGuard";

const pool = ["a", "b", "c", "d", "e"].map((id) => ({ id }));

describe("revealedFromSessions", () => {
  it("lấy câu đã chốt của phiên bỏ dở", () => {
    const r = revealedFromSessions([
      { questionIds: ["a", "b", "c"], helpers: { checked: [0, 2] }, submitted: false },
    ]);
    expect(r.fromAbandoned.sort()).toEqual(["a", "c"]);
    expect(r.fromSubmitted).toEqual([]);
  });

  it("phân loại phiên đã nộp riêng", () => {
    const r = revealedFromSessions([
      { questionIds: ["a", "b"], helpers: { checked: [1] }, submitted: true },
    ]);
    expect(r.fromSubmitted).toEqual(["b"]);
    expect(r.fromAbandoned).toEqual([]);
  });

  it("bỏ dở được ưu tiên hơn đã nộp khi trùng câu", () => {
    const r = revealedFromSessions([
      { questionIds: ["a"], helpers: { checked: [0] }, submitted: true },
      { questionIds: ["a"], helpers: { checked: [0] }, submitted: false },
    ]);
    expect(r.fromAbandoned).toEqual(["a"]);
    expect(r.fromSubmitted).toEqual([]);
  });

  it("bỏ qua helpers rác và chỉ số ngoài phạm vi", () => {
    const r = revealedFromSessions([
      { questionIds: ["a"], helpers: null },
      { questionIds: ["a"], helpers: { checked: "x" } },
      { questionIds: ["a"], helpers: { checked: [9, -1, 1.5] } },
    ]);
    expect(r.fromAbandoned).toEqual([]);
  });
});

describe("excludeRevealed", () => {
  it("loại hết câu đã lộ khi còn đủ câu", () => {
    const out = excludeRevealed(pool, { fromAbandoned: ["a"], fromSubmitted: ["b"] }, 3);
    expect(out.map((q) => q.id)).toEqual(["c", "d", "e"]);
  });

  it("bù câu đã-nộp trước khi phải bù câu bỏ-dở", () => {
    const out = excludeRevealed(pool, { fromAbandoned: ["a", "b"], fromSubmitted: ["c"] }, 3);
    expect(out.map((q) => q.id)).toEqual(["d", "e", "c"]);
  });

  it("bù cả câu bỏ dở khi ngân hàng quá nhỏ", () => {
    const out = excludeRevealed(pool, { fromAbandoned: ["a", "b", "c", "d"], fromSubmitted: [] }, 4);
    expect(out).toHaveLength(5);
    expect(out[0]!.id).toBe("e");
  });

  it("không đổi gì khi chưa lộ câu nào", () => {
    const out = excludeRevealed(pool, { fromAbandoned: [], fromSubmitted: [] }, 5);
    expect(out.map((q) => q.id)).toEqual(["a", "b", "c", "d", "e"]);
  });
});
