import { describe, expect, it } from "vitest";

import {
  gradeOne,
  optionImagesOf,
  permuteByOrder,
  reorderByDisplay,
  pickByBlueprint,
  type QuestionRow,
  DEFAULT_SCORE_RULES,
  scoreForAnswer,
  estimatePoints,
  comboBonus,
  shuffle,
} from "@/lib/grading";
import type { AnswerValue, Difficulty, QuestionKind } from "@/lib/questionKinds";

// Tạo một câu hỏi mẫu để test, cho phép ghi đè từng trường.
function makeRow(over: Partial<QuestionRow> & { kind: QuestionKind }): QuestionRow {
  return {
    id: over.id ?? "q1",
    question: "Câu hỏi",
    options: ["A", "B", "C", "D"],
    correct_index: 0,
    image_url: null,
    option_images: [],
    correct_indices: [],
    accepted_answers: [],
    pairs: null,
    correct_order: [],
    difficulty: "easy",
    tags: [],
    points: 1,
    explanation: "",
    time_limit_seconds: null,
    order_index: 0,
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
  it("sai kiểu dữ liệu", () =>
    expect(gradeOne(row, order, "2" as unknown as AnswerValue)).toBe(false));
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
  it("sai kiểu dữ liệu", () =>
    expect(gradeOne(row, order, 0 as unknown as AnswerValue)).toBe(false));
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
  it("sai kiểu dữ liệu", () =>
    expect(gradeOne(row, order, "0,1,2,3" as unknown as AnswerValue)).toBe(false));
});

// ===== pickByBlueprint =====
// Pool được tạo theo thứ tự ổn định: order_index tăng dần theo vị trí trong mảng.
function pool(spec: [Difficulty, number][]): QuestionRow[] {
  const rows: QuestionRow[] = [];
  for (const [level, n] of spec) {
    for (let i = 0; i < n; i++) {
      rows.push(
        makeRow({
          kind: "single",
          id: `${level}-${i}`,
          difficulty: level,
          order_index: rows.length,
        }),
      );
    }
  }
  return rows;
}

describe("pickByBlueprint", () => {
  it("bốc đúng số lượng yêu cầu", () => {
    const picked = pickByBlueprint(
      pool([
        ["easy", 10],
        ["medium", 10],
        ["hard", 10],
      ]),
      12,
      {},
      true,
    );
    expect(picked).toHaveLength(12);
  });

  it("không trùng id", () => {
    const picked = pickByBlueprint(
      pool([
        ["easy", 10],
        ["medium", 10],
        ["hard", 10],
      ]),
      20,
      {
        easy: 5,
        medium: 5,
        hard: 5,
      },
      true,
    );
    expect(new Set(picked.map((r) => r.id)).size).toBe(picked.length);
  });

  it("tôn trọng tỉ lệ easy/medium/hard khi pool đủ", () => {
    const picked = pickByBlueprint(
      pool([
        ["easy", 10],
        ["medium", 10],
        ["hard", 10],
      ]),
      9,
      {
        easy: 4,
        medium: 3,
        hard: 2,
      },
      true,
    );
    const count = (d: Difficulty) => picked.filter((r) => r.difficulty === d).length;
    expect(picked).toHaveLength(9);
    expect(count("easy")).toBe(4);
    expect(count("medium")).toBe(3);
    expect(count("hard")).toBe(2);
  });

  it("lấp phần thiếu bằng câu ngẫu nhiên khi pool theo độ khó không đủ", () => {
    const picked = pickByBlueprint(
      pool([
        ["easy", 1],
        ["medium", 10],
      ]),
      6,
      { easy: 4, hard: 2 },
      true,
    );
    expect(picked).toHaveLength(6);
    expect(picked.filter((r) => r.difficulty === "easy")).toHaveLength(1);
    expect(picked.filter((r) => r.difficulty === "medium")).toHaveLength(5);
  });

  it("không vượt quá kích thước pool", () => {
    const picked = pickByBlueprint(pool([["easy", 3]]), 10, {}, true);
    expect(picked).toHaveLength(3);
  });
});

// ===== pickByBlueprint – cờ trộn câu hỏi =====
describe("pickByBlueprint – shuffleQuestions", () => {
  const bigPool = () =>
    pool([
      ["easy", 8],
      ["medium", 8],
      ["hard", 8],
    ]);
  const orderKey = (rows: QuestionRow[]) => rows.map((r) => r.id).join(",");

  it("shuffleQuestions=false: giữ nguyên thứ tự tương đối của pool (dãy con tăng dần)", () => {
    const p = bigPool();
    const picked = pickByBlueprint(p, 12, { easy: 4, medium: 4, hard: 4 }, false);
    const indexes = picked.map((r) => r.order_index);
    expect(picked).toHaveLength(12);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
  });

  it("shuffleQuestions=false: chạy 20 lần cho cùng một thứ tự", () => {
    const p = bigPool();
    // Blueprint phủ kín pool để tập câu được chọn là cố định, chỉ còn xét thứ tự.
    const results = Array.from({ length: 20 }, () =>
      orderKey(pickByBlueprint(p, 24, { easy: 8, medium: 8, hard: 8 }, false)),
    );
    expect(new Set(results).size).toBe(1);
  });

  it("shuffleQuestions=true: 20 lần có ít nhất 2 thứ tự khác nhau", () => {
    const p = bigPool();
    const results = Array.from({ length: 20 }, () =>
      orderKey(pickByBlueprint(p, 24, { easy: 8, medium: 8, hard: 8 }, true)),
    );
    expect(new Set(results).size).toBeGreaterThanOrEqual(2);
  });

  it("cả hai chế độ: đúng số lượng, không trùng id, tôn trọng blueprint", () => {
    for (const flag of [false, true]) {
      const picked = pickByBlueprint(bigPool(), 9, { easy: 4, medium: 3, hard: 2 }, flag);
      expect(picked).toHaveLength(9);
      expect(new Set(picked.map((r) => r.id)).size).toBe(9);
      expect(picked.filter((r) => r.difficulty === "easy")).toHaveLength(4);
      expect(picked.filter((r) => r.difficulty === "medium")).toHaveLength(3);
      expect(picked.filter((r) => r.difficulty === "hard")).toHaveLength(2);
    }
  });
});

describe("ảnh phương án – hoán vị theo thứ tự trộn", () => {
  const row = makeRow({
    kind: "single",
    correct_index: 2,
    option_images: ["a.webp", "", "c.webp", "d.webp"],
  });

  it("bù đủ số phần tử bằng chuỗi rỗng", () => {
    const thin = makeRow({ kind: "single", option_images: ["x.webp"] });
    expect(optionImagesOf(thin)).toEqual(["x.webp", "", "", ""]);
  });

  it("bỏ qua phần tử thừa", () => {
    const fat = makeRow({ kind: "single", option_images: ["1", "2", "3", "4", "5", "6"] });
    expect(optionImagesOf(fat)).toEqual(["1", "2", "3", "4"]);
  });

  it("null cũng cho ra mảng rỗng đúng độ dài", () => {
    const none = makeRow({ kind: "single", option_images: null });
    expect(optionImagesOf(none)).toEqual(["", "", "", ""]);
  });

  it("ảnh đi kèm đúng phương án sau khi trộn", () => {
    const order = [2, 0, 3, 1];
    const options = permuteByOrder(row.options, order, "");
    const images = permuteByOrder(optionImagesOf(row), order, "");
    expect(options).toEqual(["C", "A", "D", "B"]);
    expect(images).toEqual(["c.webp", "a.webp", "d.webp", ""]);
    // Đáp án đúng (gốc index 2 = "C") nằm ở vị trí hiển thị 0 và giữ đúng ảnh của nó.
    expect(images[options.indexOf("C")]).toBe("c.webp");
  });

  it("mọi hoán vị đều giữ cặp (phương án, ảnh)", () => {
    const orders = [
      [0, 1, 2, 3],
      [3, 2, 1, 0],
      [1, 3, 0, 2],
    ];
    const base = optionImagesOf(row);
    for (const order of orders) {
      const options = permuteByOrder(row.options, order, "");
      const images = permuteByOrder(base, order, "");
      options.forEach((opt, i) => {
        expect(images[i]).toBe(base[row.options.indexOf(opt)]);
      });
    }
  });

  it("chỉ số ngoài dải trả về giá trị mặc định", () => {
    expect(permuteByOrder(["a", "b"], [1, 9, -1], "")).toEqual(["b", "", ""]);
  });
});

describe("scoreForAnswer", () => {
  const rules = { ...DEFAULT_SCORE_RULES };

  it("câu sai không có điểm khi bỏ trống", () => {
    expect(scoreForAnswer(2, false, false, 0, rules)).toBe(0);
  });

  it("trừ điểm khi trả lời sai và bật trừ điểm", () => {
    expect(scoreForAnswer(2, false, true, 0, { ...rules, negativeMarking: 0.5 })).toBe(-1);
  });

  it("hai câu đúng đầu chuỗi chưa được thưởng", () => {
    expect(scoreForAnswer(1, true, true, 1, rules)).toBe(1);
    expect(scoreForAnswer(1, true, true, 2, rules)).toBe(1);
  });

  it("thưởng luỹ tiến từ câu đúng thứ ba", () => {
    expect(scoreForAnswer(1, true, true, 3, rules)).toBe(2);
    expect(scoreForAnswer(1, true, true, 4, rules)).toBe(3);
    expect(scoreForAnswer(1, true, true, 5, rules)).toBe(4);
  });

  it("không vượt trần điểm thưởng khi có đặt trần", () => {
    expect(scoreForAnswer(1, true, true, 20, { ...rules, streakMaxBonus: 5 })).toBe(6);
  });

  it("combo luỹ tiến vô tận khi không đặt trần", () => {
    expect(scoreForAnswer(1, true, true, 20, { ...rules, streakMaxBonus: 0 })).toBe(19);
  });

  it("vật phẩm X2 nhân đôi cả điểm thưởng combo", () => {
    expect(scoreForAnswer(1, true, true, 5, rules, { x2: true })).toBe(8);
    expect(scoreForAnswer(1, true, true, 1, rules, { x2: true })).toBe(2);
  });

  it("nhân đôi điểm khi đạt ngưỡng chuỗi", () => {
    expect(scoreForAnswer(2, true, true, 5, { ...rules, streakBonus: false, doublePointsAfter: 5 })).toBe(4);
  });


  it("tắt thưởng chuỗi thì chỉ còn điểm gốc", () => {
    expect(scoreForAnswer(3, true, true, 9, { ...rules, streakBonus: false })).toBe(3);
  });
});

describe("estimatePoints", () => {
  it("không có combo thì điểm bằng số câu đúng", () => {
    expect(estimatePoints(10, 2)).toBe(10);
  });

  it("cộng dồn thưởng combo luỹ tiến", () => {
    // chuỗi 5: các câu thứ 3,4,5 được +1,+2,+3
    expect(estimatePoints(10, 5)).toBe(10 + 1 + 2 + 3);
  });

  it("chuỗi không thể dài hơn số câu đúng", () => {
    expect(estimatePoints(2, 9)).toBe(2);
  });

  it("comboBonus bắt đầu từ combo thứ 3", () => {
    expect(comboBonus(2, DEFAULT_SCORE_RULES)).toBe(0);
    expect(comboBonus(3, DEFAULT_SCORE_RULES)).toBe(1);
  });
});

describe("shuffle – seed", () => {
  const pool = Array.from({ length: 12 }, (_, i) => i);

  it("cùng seed cho cùng kết quả", () => {
    expect(shuffle(pool, 7)).toEqual(shuffle(pool, 7));
  });

  it("khác seed thì thứ tự khác nhau", () => {
    expect(shuffle(pool, 1)).not.toEqual(shuffle(pool, 2));
  });

  it("giữ nguyên tập phần tử và không sửa mảng gốc", () => {
    const out = shuffle(pool, 5);
    expect([...out].sort((a, b) => a - b)).toEqual(pool);
    expect(pool).toEqual(Array.from({ length: 12 }, (_, i) => i));
  });
});

describe("reorderByDisplay", () => {
  it("hoán vị theo thứ tự hiển thị", () => {
    expect(reorderByDisplay(["a", "b", "c"], [2, 0, 1])).toEqual(["c", "a", "b"]);
  });
  it("thiếu phần tử thì trả về chuỗi rỗng", () => {
    expect(reorderByDisplay(["a"], [0, 1])).toEqual(["a", ""]);
  });
  it("danh sách rỗng hoặc null vẫn an toàn", () => {
    expect(reorderByDisplay(null, [0, 1])).toEqual(["", ""]);
    expect(reorderByDisplay(undefined, [])).toEqual([]);
  });
});

describe("dung sai chính tả câu điền khuyết", () => {
  it("tha lỗi gõ nhẹ với đáp án đủ dài", () => {
    expect(fillBlankMatches("Đà Nẵmg", ["Đà Nẵng"])).toBe(true);
    expect(fillBlankMatches("kiem soat khong lu", ["kiểm soát không lưu"])).toBe(true);
  });
  it("không tha lỗi với đáp án quá ngắn", () => {
    expect(fillBlankMatches("ILS", ["IFR"])).toBe(false);
    expect(typoAllowance(3)).toBe(0);
    expect(typoAllowance(6)).toBe(1);
    expect(typoAllowance(12)).toBe(2);
  });
  it("từ chối đáp án rỗng hoặc khác hẳn", () => {
    expect(fillBlankMatches("   ", ["Đà Nẵng"])).toBe(false);
    expect(fillBlankMatches("Hà Nội", ["Đà Nẵng"])).toBe(false);
  });
  it("khoảng cách Levenshtein cơ bản", () => {
    expect(levenshtein("abc", "abc")).toBe(0);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
});

describe("chấm điểm một phần câu nhiều đáp án", () => {
  const multi = (over: Partial<GradingQuestionRow> = {}) =>
    ({
      id: "m1",
      question: "Chọn các sân bay miền Trung",
      options: ["Đà Nẵng", "Phú Bài", "Nội Bài", "Tân Sơn Nhất"],
      correct_index: 0,
      image_url: null,
      option_images: null,
      kind: "multi",
      correct_indices: [0, 1],
      accepted_answers: [],
      pairs: null,
      correct_order: [],
      difficulty: "medium",
      tags: [],
      points: 1,
      explanation: "",
      time_limit_seconds: null,
      order_index: 0,
      ...over,
    }) as GradingQuestionRow;
  const order = [0, 1, 2, 3];

  it("chọn đủ và đúng được trọn điểm", () => {
    expect(gradeFraction(multi(), order, [0, 1])).toBe(1);
  });
  it("chọn đúng một nửa được 0.5", () => {
    expect(gradeFraction(multi(), order, [0])).toBe(0.5);
  });
  it("chọn thêm đáp án sai bị trừ", () => {
    expect(gradeFraction(multi(), order, [0, 1, 2])).toBe(0.5);
    expect(gradeFraction(multi(), order, [2, 3])).toBe(0);
  });
  it("không âm và không vượt quá 1", () => {
    expect(gradeFraction(multi(), order, [2])).toBe(0);
    expect(gradeFraction(multi(), order, [])).toBe(0);
  });
});
