import { describe, expect, it } from "vitest";

import {
  MAX_NEW_ANSWERS_PER_SAVE,
  droppedNewAnswers,
  limitNewAnswers,
} from "@/lib/exam/answerIntake";

describe("limitNewAnswers", () => {
  it("luôn cho phép sửa câu đã lưu, không tính vào trần", () => {
    const saved = { "0": 1, "1": 2, "2": 3 };
    const incoming = { "0": 9, "1": 9, "2": 9 };
    expect(limitNewAnswers(saved, incoming, 1)).toEqual(incoming);
  });

  it("giới hạn số câu mới trong một request", () => {
    const incoming = { "0": 1, "1": 1, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1 };
    const out = limitNewAnswers({}, incoming, 5);
    expect(Object.keys(out)).toEqual(["0", "1", "2", "3", "4"]);
  });

  it("người thi bình thường (delta nhỏ) không bị ảnh hưởng", () => {
    const saved = { "0": 1, "1": 2 };
    const incoming = { "2": 3 };
    expect(limitNewAnswers(saved, incoming, MAX_NEW_ANSWERS_PER_SAVE)).toEqual(incoming);
  });

  it("đếm được số câu bị bỏ qua", () => {
    const incoming = { "0": 1, "1": 1, "2": 1, "3": 1, "4": 1, "5": 1, "6": 1 };
    expect(droppedNewAnswers({}, incoming, 5)).toBe(2);
    expect(droppedNewAnswers({ "0": 1 }, { "0": 2 }, 5)).toBe(0);
  });
});
