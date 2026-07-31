import { describe, expect, it } from "vitest";

import { parseDocxQuestions } from "@/lib/docxParse";

describe("parseDocxQuestions", () => {
  it("đọc được mẫu chuẩn của ban soạn đề", () => {
    const out = parseDocxQuestions(
      [
        "Câu 1: Sân bay Đà Nẵng có mã ICAO là gì?",
        "A. VVDN",
        "B. VVNB",
        "C. VVTS",
        "D. VVCR",
        "Đáp án: A",
        "Giải thích: VVDN là mã ICAO của Đà Nẵng.",
      ].join("\n"),
    );
    expect(out).toHaveLength(1);
    expect(out[0].question).toBe("Sân bay Đà Nẵng có mã ICAO là gì?");
    expect(out[0].options).toEqual(["VVDN", "VVNB", "VVTS", "VVCR"]);
    expect(out[0].correct_index).toBe(0);
    expect(out[0].explanation).toContain("VVDN");
  });

  it("tách được nhiều câu liên tiếp", () => {
    const out = parseDocxQuestions(
      ["Câu 1. Một cộng một?", "A. 1", "B. 2", "Đáp án: B", "Câu 2) Hai cộng hai?", "A. 4", "B. 5", "ĐA: A"].join("\n"),
    );
    expect(out).toHaveLength(2);
    expect(out[0].correct_index).toBe(1);
    expect(out[1].correct_index).toBe(0);
    expect(out[1].number).toBe(2);
  });

  it("nhận đáp án đúng khi được in đậm", () => {
    const out = parseDocxQuestions(["Câu 1: Thủ đô Việt Nam?", "A. Huế", "B. **Hà Nội**", "C. Đà Nẵng"].join("\n"));
    expect(out[0].correct_index).toBe(1);
  });

  it("nhận đáp án đúng khi đánh dấu sao", () => {
    const out = parseDocxQuestions(["Câu 1: Màu của trời?", "A. Đỏ", "* B. Xanh"].join("\n"));
    expect(out[0].correct_index).toBe(1);
  });

  it("nối phần nội dung bị xuống dòng", () => {
    const out = parseDocxQuestions(
      ["Câu 1: Trong điều kiện thời tiết xấu,", "kiểm soát viên phải làm gì?", "A. Giữ nguyên", "cách bay", "B. Đổi mực bay", "Đáp án: B"].join("\n"),
    );
    expect(out[0].question).toBe("Trong điều kiện thời tiết xấu, kiểm soát viên phải làm gì?");
    expect(out[0].options[0]).toBe("Giữ nguyên cách bay");
  });

  it("gắn ảnh cho câu hỏi và cho từng phương án", () => {
    const out = parseDocxQuestions(
      ["Câu 1: Biển báo nào đúng?", "[[IMG:0]]", "A. Biển tròn", "[[IMG:1]]", "B. Biển vuông", "Đáp án: A"].join("\n"),
    );
    expect(out[0].imageRef).toBe(0);
    expect(out[0].optionImageRefs).toEqual([1, null]);
  });

  it("bỏ qua câu thiếu phương án", () => {
    const out = parseDocxQuestions(["Câu 1: Câu hỏi chưa soạn xong", "A. Chỉ một phương án"].join("\n"));
    expect(out).toHaveLength(0);
  });

  it("đánh dấu -1 khi không xác định được đáp án", () => {
    const out = parseDocxQuestions(["Câu 1: Chưa ghi đáp án?", "A. Một", "B. Hai"].join("\n"));
    expect(out[0].correct_index).toBe(-1);
  });

  it("không nhầm khi nhiều phương án cùng in đậm", () => {
    const out = parseDocxQuestions(["Câu 1: Hỏi gì đó?", "A. **Một**", "B. **Hai**"].join("\n"));
    expect(out[0].correct_index).toBe(-1);
  });

  it("bỏ qua văn bản rác trước câu đầu tiên", () => {
    const out = parseDocxQuestions(
      ["TỔNG CÔNG TY QUẢN LÝ BAY VIỆT NAM", "ĐỀ THI THỬ", "Câu 1: Hỏi?", "A. Một", "B. Hai", "Đáp án: A"].join("\n"),
    );
    expect(out).toHaveLength(1);
    expect(out[0].question).toBe("Hỏi?");
  });
});
