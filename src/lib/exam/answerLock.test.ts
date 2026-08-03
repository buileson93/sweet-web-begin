import { describe, expect, it } from "vitest";

import {
  filterSavableAnswers,
  readCheckedIndexes,
  withCheckedIndex,
} from "@/lib/exam/answerLock";

describe("khoá đáp án đã chấm ngay", () => {
  it("đọc danh sách rỗng khi chưa có gì", () => {
    expect(readCheckedIndexes(null)).toEqual([]);
    expect(readCheckedIndexes({})).toEqual([]);
    expect(readCheckedIndexes({ checked: "x" })).toEqual([]);
  });

  it("chỉ nhận chỉ số nguyên không âm", () => {
    expect(readCheckedIndexes({ checked: [0, 2, -1, "3", 1.5] })).toEqual([0, 2]);
  });

  it("thêm chỉ số mà không trùng và giữ nguyên trợ giúp khác", () => {
    const h = withCheckedIndex({ fiftyFifty: [1], checked: [0] }, 2);
    expect(h.checked).toEqual([0, 2]);
    expect(h.fiftyFifty).toEqual([1]);
    expect(withCheckedIndex(h, 2).checked).toEqual([0, 2]);
  });

  it("autosave không ghi đè được câu đã chốt", () => {
    const out = filterSavableAnswers({ "0": 1, "1": 2, "2": 3 }, [0, 2]);
    expect(out).toEqual({ "1": 2 });
  });

  it("giữ nguyên khi chưa chốt câu nào", () => {
    const inc = { "0": 1 };
    expect(filterSavableAnswers(inc, [])).toBe(inc);
  });
});
