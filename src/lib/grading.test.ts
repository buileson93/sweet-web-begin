import { describe, expect, it } from "vitest";

import { gradeOne, pickByBlueprint, type QuestionRow } from "@/lib/grading";
import type { AnswerValue, Difficulty, QuestionKind } from "@/lib/questionKinds";

// Tạo một câu hỏi mẫu để test, cho phép ghi đè từng trường.
function makeRow(over: Partial<QuestionRow> & { kind: QuestionKind }): QuestionRow {
  return {
    id: over.id ?? "q1",
    question: "Câu hỏi",
    options: ["A", "B", "C", "D"],
    correct_index: 0,
    image_url: null,
    correct_indices: [],
    accepted_answers: [],
    pairs: null,
    correct_order: [],
    difficulty: "easy",
    tags: [],
    points: 1,
    explanation: "",
    time_limit_seconds: null,
    ...over,
  };
}

/** Thứ tự hiển thị giữ nguyên (không trộn). */
const identity = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("gradeOne – single", () => {
  const row = makeRow({ kind: "single", correct_index: 2 });
  const order = identity(4);

  it("đúng hoàn toàn", () => expect(gradeOne(row, order, 2)).toBe(true));
  it("chọn sai", () => expect(gradeOne(row, order, 0)).toBe(false));
  it("không trả lời", () => expect(gradeOne(row, order, undefined)).toBe(false));
  it("index âm", () => expect(gradeOne(row, order, -1)).toBe(false));
  it("index vượt dải", () => expect(gradeOne(row, order, 9)).toBe(false));
  it("sai kiểu dữ liệu", () => expect(gradeOne(row, order, "2" as unknown as AnswerValue)).toBe(false));
  it("tôn trọng thứ tự trộn", () => {
    // Hiển thị vị trí 0 tương ứng phương án gốc số 2
    expect(gradeOne(row, [2, 0, 1, 3], 0)).toBe(true);
    expect(gradeOne(row, [2, 0, 1, 3], 1)).toBe(false);
  });
});

describe("gradeOne – true_false", () => {
  const row = makeRow({ kind: "true_false", options: ["Đúng", "Sai"], correct_index: 1 });
  const order = identity(2);

  it("đúng hoàn toàn", () => expect(gradeOne(row, order, 1)).toBe(true));
  it("chọn sai", () => expect(gradeOne(row, order, 0)).toBe(false));
  it("không trả lời", () => expect(gradeOne(row, order, undefined)).toBe(false));
  it("giá trị rác", () => {
    expect(gradeOne(row, order, -2)).toBe(false);
    expect(gradeOne(row, order, 5)).toBe(false);
    expect(gradeOne(row, order, true as unknown as AnswerValue)).toBe(false);
  });
});

describe("gradeOne – multi", () => {
  const row = makeRow({ kind: "multi", correct_indices: [1, 3] });
  const order = identity(4);

  it("đúng hoàn toàn", () => expect(gradeOne(row, order, [1, 3])).toBe(true));
  it("chọn thiếu 1 đáp án là SAI", () => expect(gradeOne(row, order, [1])).toBe(false));
  it("chọn thừa là SAI", () => expect(gradeOne(row, order, [1, 2, 3])).toBe(false));
  it("chọn sai hoàn toàn", () => expect(gradeOne(row, order, [0, 2])).toBe(false));
  it("không trả lời", () => expect(gradeOne(row, order, undefined)).toBe(false));
  it("mảng rỗng", () => expect(gradeOne(row, order, [])).toBe(false));
  it("giá trị rác (index âm/vượt dải/sai kiểu)", () => {
    expect(gradeOne(row, order, [-1, 3])).toBe(false);
    expect(gradeOne(row, order, [1, 99])).toBe(false);
    expect(gradeOne(row, order, 1 as unknown as AnswerValue)).toBe(false);
  });
});

describe("gradeOne – fill_blank", () => {
  const row = makeRow({ kind: "fill_blank", accepted_answers: ["Hà Nội", "thủ đô"] });
  const order = identity(0);

  it("đúng hoàn toàn", () => expect(gradeOne(row, order, "Hà Nội")).toBe(true));
  it("so sánh sau normalizeText (không dấu, thường hoá)", () => {
    expect(gradeOne(row, order, "  ha noi ")).toBe(true);
    expect(gradeOne(row, order, "THU DO")).toBe(true);
  });
  it("trả lời sai", () => expect(gradeOne(row, order, "Đà Nẵng")).toBe(false));
  it("không trả lời", () => expect(gradeOne(row, order, undefined)).toBe(false));
  it("chuỗi rỗng", () => expect(gradeOne(row, order, "   ")).toBe(false));
  it("sai kiểu dữ liệu", () => expect(gradeOne(row, order, 0 as unknown as AnswerValue)).toBe(false));
});

describe("gradeOne – matching", () => {
  const row = makeRow({
    kind: "matching",
    pairs: [
      { left: "L1", right: "R1" },
      { left: "L2", right: "R2" },
      { left: "L3", right: "R3" },
    ],
  });
  const order = identity(3);

  it("đúng hoàn toàn", () => expect(gradeOne(row, order, { "0": 0, "1": 1, "2": 2 })).toBe(true));
  it("thiếu 1 cặp là SAI", () => expect(gradeOne(row, order, { "0": 0, "1": 1 })).toBe(false));
  it("nối sai", () => expect(gradeOne(row, order, { "0": 1, "1": 0, "2": 2 })).toBe(false));
  it("không trả lời", () => expect(gradeOne(row, order, undefined)).toBe(false));
  it("giá trị rác (index âm/vượt dải/sai kiểu)", () => {
    expect(gradeOne(row, order, { "0": -1, "1": 1, "2": 2 })).toBe(false);
    expect(gradeOne(row, order, { "0": 0, "1": 1, "2": 7 })).toBe(false);
    expect(gradeOne(row, order, [0, 1, 2] as unknown as AnswerValue)).toBe(false);
  });
  it("tôn trọng thứ tự trộn cột phải", () => {
    // order[display] = vị trí gốc
    expect(gradeOne(row, [2, 0, 1], { "0": 1, "1": 2, "2": 0 })).toBe(true);
  });
});

describe("gradeOne – ordering", () => {
  const row = makeRow({ kind: "ordering", correct_order: [0, 1, 2, 3] });
  const order = identity(4);

  it("đúng hoàn toàn", () => expect(gradeOne(row, order, [0, 1, 2, 3])).toBe(true));
  it("đảo 2 phần tử là SAI", () => expect(gradeOne(row, order, [1, 0, 2, 3])).toBe(false));
  it("thiếu phần tử là SAI", () => expect(gradeOne(row, order, [0, 1, 2])).toBe(false));
  it("không trả lời", () => expect(gradeOne(row, order, undefined)).toBe(false));
  it("sai kiểu dữ liệu", () => expect(gradeOne(row, order, "0,1,2,3" as unknown as AnswerValue)).toBe(false));
});

// ===== pickByBlueprint =====
function pool(spec: [Difficulty, number][]): QuestionRow[] {
  const rows: QuestionRow[] = [];
  for (const [level, n] of spec) {
    for (let i = 0; i < n; i++) {
      rows.push(makeRow({ kind: "single", id: `${level}-${i}`, difficulty: level }));
    }
  }
  return rows;
}

describe("pickByBlueprint", () => {
  it("bốc đúng số lượng yêu cầu", () => {
    const picked = pickByBlueprint(pool([["easy", 10], ["medium", 10], ["hard", 10]]), 12, {});
    expect(picked).toHaveLength(12);
  });

  it("không trùng id", () => {
    const picked = pickByBlueprint(pool([["easy", 10], ["medium", 10], ["hard", 10]]), 20, {
      easy: 5,
      medium: 5,
      hard: 5,
    });
    expect(new Set(picked.map((r) => r.id)).size).toBe(picked.length);
  });

  it("tôn trọng tỉ lệ easy/medium/hard khi pool đủ", () => {
    const picked = pickByBlueprint(pool([["easy", 10], ["medium", 10], ["hard", 10]]), 9, {
      easy: 4,
      medium: 3,
      hard: 2,
    });
    const count = (d: Difficulty) => picked.filter((r) => r.difficulty === d).length;
    expect(picked).toHaveLength(9);
    expect(count("easy")).toBe(4);
    expect(count("medium")).toBe(3);
    expect(count("hard")).toBe(2);
  });

  it("lấp phần thiếu bằng câu ngẫu nhiên khi pool theo độ khó không đủ", () => {
    const picked = pickByBlueprint(pool([["easy", 1], ["medium", 10]]), 6, { easy: 4, hard: 2 });
    expect(picked).toHaveLength(6);
    expect(picked.filter((r) => r.difficulty === "easy")).toHaveLength(1);
    expect(picked.filter((r) => r.difficulty === "medium")).toHaveLength(5);
  });

  it("không vượt quá kích thước pool", () => {
    const picked = pickByBlueprint(pool([["easy", 3]]), 10, {});
    expect(picked).toHaveLength(3);
  });
});
