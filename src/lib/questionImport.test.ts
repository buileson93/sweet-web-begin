import { describe, expect, it } from "vitest";

import {
  answerToIndex,
  buildImportPreview,
  chunk,
  issuesToCsv,
  parseDifficulty,
  parseKind,
  parsedToDraft,
  rowToDraft,
  selectImportable,
  type ImportDraft,
} from "@/lib/questionImport";

const okRow = {
  cau_hoi: "Sân bay Đà Nẵng có mã ICAO là gì?",
  phuong_an_a: "VVDN",
  phuong_an_b: "VVNB",
  phuong_an_c: "VVTS",
  phuong_an_d: "VVCR",
  dap_an: "A",
  do_kho: "Dễ",
  diem: "2",
  nhan: "ICAO, sân bay",
  giai_thich: "VVDN là mã Đà Nẵng.",
};

describe("parseDifficulty", () => {
  it("nhận cả tiếng Việt có dấu, không dấu và tiếng Anh", () => {
    expect(parseDifficulty("Dễ")).toBe("easy");
    expect(parseDifficulty("de")).toBe("easy");
    expect(parseDifficulty(" TRUNG BÌNH ")).toBe("medium");
    expect(parseDifficulty("hard")).toBe("hard");
  });

  it("giá trị lạ hoặc rỗng mặc định Trung bình", () => {
    expect(parseDifficulty(undefined)).toBe("medium");
    expect(parseDifficulty("siêu khó")).toBe("medium");
  });
});

describe("parseKind", () => {
  it("ánh xạ các cách ghi loại câu thường gặp", () => {
    expect(parseKind("Đúng/Sai")).toBe("true_false");
    expect(parseKind("nhieu dap an")).toBe("multi");
    expect(parseKind("fill_blank")).toBe("fill_blank");
  });

  it("mặc định là câu một đáp án", () => {
    expect(parseKind(undefined)).toBe("single");
    expect(parseKind("???")).toBe("single");
  });
});

describe("answerToIndex", () => {
  it("chữ cái và số đều ra đúng chỉ số", () => {
    expect(answerToIndex("A")).toBe(0);
    expect(answerToIndex(" d ")).toBe(3);
    expect(answerToIndex("1")).toBe(0);
    expect(answerToIndex("4")).toBe(3);
  });

  it("giá trị không hợp lệ trả về -1", () => {
    expect(answerToIndex("")).toBe(-1);
    expect(answerToIndex(undefined)).toBe(-1);
    expect(answerToIndex("#")).toBe(-1);
  });
});

describe("rowToDraft", () => {
  it("đọc đủ các cột tiếng Việt", () => {
    const d = rowToDraft(okRow, 2);
    expect(d.question).toContain("Đà Nẵng");
    expect(d.options).toEqual(["VVDN", "VVNB", "VVTS", "VVCR"]);
    expect(d.correct_index).toBe(0);
    expect(d.difficulty).toBe("easy");
    expect(d.points).toBe(2);
    expect(d.tags).toEqual(["ICAO", "sân bay"]);
    expect(d.line).toBe(2);
  });

  it("chấp nhận tên cột tiếng Anh", () => {
    const d = rowToDraft(
      { question: "Q?", option_a: "A1", option_b: "B1", answer: "B", points: "3" },
      5,
    );
    expect(d.question).toBe("Q?");
    expect(d.options).toEqual(["A1", "B1"]);
    expect(d.correct_index).toBe(1);
    expect(d.points).toBe(3);
  });

  it("điểm sai định dạng hoặc để trống thì tính 1", () => {
    expect(rowToDraft({ ...okRow, diem: "" }, 2).points).toBe(1);
    expect(rowToDraft({ ...okRow, diem: "abc" }, 2).points).toBe(1);
    expect(rowToDraft({ ...okRow, diem: "0" }, 2).points).toBe(1);
  });

  it("giữ hai ô phương án đầu kể cả khi trống, bỏ các ô trống phía sau", () => {
    const d = rowToDraft({ cau_hoi: "Q?", phuong_an_a: "X", dap_an: "A" }, 2);
    expect(d.options).toEqual(["X", ""]);
  });
});

describe("parsedToDraft", () => {
  it("chuyển kết quả đọc Word và giữ tham chiếu ảnh", () => {
    const d = parsedToDraft(
      {
        question: "Q?",
        options: ["A", "B"],
        correct_index: 1,
        explanation: "vì vậy",
        imageRef: 3,
        optionImageRefs: [null, 4],
      } as never,
      7,
    );
    expect(d.kind).toBe("single");
    expect(d.imageRef).toBe(3);
    expect(d.optionImageRefs).toEqual([null, 4]);
    expect(d.line).toBe(7);
  });
});

function draft(over: Partial<ImportDraft> = {}): ImportDraft {
  return {
    line: 2,
    question: "Sân bay Đà Nẵng có mã ICAO là gì?",
    options: ["VVDN", "VVNB", "VVTS", "VVCR"],
    correct_index: 0,
    kind: "single",
    difficulty: "medium",
    points: 1,
    explanation: "",
    tags: [],
    ...over,
  };
}

describe("buildImportPreview", () => {
  it("câu hợp lệ được đánh dấu ok", () => {
    const [item] = buildImportPreview([draft()], new Set<string>());
    expect(item.status).toBe("ok");
    expect(item.duplicate).toBe(false);
  });

  it("câu thiếu đáp án đúng bị đánh dấu lỗi", () => {
    const [item] = buildImportPreview([draft({ correct_index: -1 })], new Set<string>());
    expect(item.status).toBe("error");
    expect(item.messages.length).toBeGreaterThan(0);
  });

  it("trùng nội dung trong cùng tệp (khác dấu, khác hoa thường)", () => {
    const items = buildImportPreview(
      [draft(), draft({ line: 3, question: "SAN BAY DA NANG CO MA ICAO LA GI?" })],
      new Set<string>(),
    );
    expect(items[0].duplicate).toBe(false);
    expect(items[1].duplicate).toBe(true);
    expect(items[1].status).toBe("warn");
  });

  it("trùng với ngân hàng câu hỏi hiện có", () => {
    const items = buildImportPreview(
      [draft()],
      new Set(["san bay da nang co ma icao la gi"]),
    );
    expect(items[0].duplicate).toBe(true);
    expect(items[0].messages.join(" ")).toContain("đã có câu hỏi trùng");
  });
});

describe("selectImportable", () => {
  const items = buildImportPreview(
    [draft(), draft({ line: 3 }), draft({ line: 4, question: "Q khác?", correct_index: -1 })],
    new Set<string>(),
  );

  it("mặc định bỏ cả câu lỗi lẫn câu trùng", () => {
    expect(selectImportable(items, false)).toHaveLength(1);
  });

  it("cho phép nhập cả câu trùng nhưng không bao giờ nhập câu lỗi", () => {
    const picked = selectImportable(items, true);
    expect(picked).toHaveLength(2);
    expect(picked.every((i) => i.status !== "error")).toBe(true);
  });
});

describe("issuesToCsv", () => {
  it("chỉ liệt kê dòng có vấn đề và bọc ngoặc kép để an toàn", () => {
    const items = buildImportPreview(
      [draft(), draft({ line: 3, question: "Q lỗi?", correct_index: -1 })],
      new Set<string>(),
    );
    const csv = issuesToCsv(items);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2); // tiêu đề + 1 dòng lỗi
    expect(lines[1]).toContain('"3"');
    expect(lines[1]).toContain("Lỗi");
  });

  it("thoát dấu ngoặc kép trong nội dung câu hỏi", () => {
    const items = buildImportPreview(
      [draft({ question: 'Gọi "Mayday" mấy lần?', correct_index: -1 })],
      new Set<string>(),
    );
    expect(issuesToCsv(items)).toContain('""Mayday""');
  });
});

describe("chunk", () => {
  it("chia đúng theo lô và giữ nguyên thứ tự", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 50)).toEqual([]);
    expect(chunk([1, 2], 50)).toEqual([[1, 2]]);
  });
});
