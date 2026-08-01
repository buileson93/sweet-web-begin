import { describe, expect, it } from "vitest";

import { isAnswered, normalizeText, KIND_LABEL, QUESTION_KINDS } from "@/lib/questionKinds";

/**
 * normalizeText là nền móng của việc chấm câu điền đáp án (grading.ts dùng lại).
 * Sai ở đây thì bài thi chấm sai mà không có cảnh báo nào, nên phủ kỹ tiếng Việt.
 */
describe("normalizeText", () => {
  it("bỏ dấu tiếng Việt", () => {
    expect(normalizeText("Đường băng")).toBe("duong bang");
    expect(normalizeText("Kiểm soát viên không lưu")).toBe("kiem soat vien khong luu");
    expect(normalizeText("mở rộng")).toBe("mo rong");
  });

  it("xử lý chữ đ hoa và thường", () => {
    expect(normalizeText("ĐÀ NẴNG")).toBe("da nang");
    expect(normalizeText("đình chỉ")).toBe("dinh chi");
  });

  it("gộp khoảng trắng thừa và cắt hai đầu", () => {
    expect(normalizeText("  sân   bay \n Nội  Bài ")).toBe("san bay noi bai");
    expect(normalizeText("\t\tVVDN\t")).toBe("vvdn");
  });

  it("bỏ dấu câu nhưng giữ chữ số", () => {
    expect(normalizeText("Mực bay FL-330, đúng!")).toBe("muc bay fl 330 dung");
    expect(normalizeText("A.B,C;D")).toBe("a b c d");
  });

  it("hai cách gõ Unicode khác nhau cho cùng một chữ vẫn ra một kết quả", () => {
    // "ế" dựng sẵn (NFC) và "ế" tổ hợp (NFD)
    expect(normalizeText("\u1EBF")).toBe(normalizeText("e\u0302\u0301"));
  });

  it("chuỗi rỗng hoặc chỉ có ký tự lạ trả về rỗng", () => {
    expect(normalizeText("")).toBe("");
    expect(normalizeText("   ")).toBe("");
    expect(normalizeText("!!!???")).toBe("");
  });
});

describe("isAnswered", () => {
  it("câu một đáp án / đúng sai: chỉ tính khi chỉ số >= 0", () => {
    expect(isAnswered("single", 0)).toBe(true);
    expect(isAnswered("single", -1)).toBe(false);
    expect(isAnswered("true_false", 1)).toBe(true);
    expect(isAnswered("single", undefined)).toBe(false);
  });

  it("câu nhiều đáp án: mảng rỗng coi như chưa trả lời", () => {
    expect(isAnswered("multi", [])).toBe(false);
    expect(isAnswered("multi", [0, 2])).toBe(true);
  });

  it("câu điền: chuỗi toàn khoảng trắng coi như bỏ trống", () => {
    expect(isAnswered("fill_blank", "   ")).toBe(false);
    expect(isAnswered("fill_blank", "VVDN")).toBe(true);
  });

  it("câu nối cặp và sắp xếp", () => {
    expect(isAnswered("matching", {})).toBe(false);
    expect(isAnswered("matching", { a: 1 })).toBe(true);
    expect(isAnswered("ordering", [])).toBe(false);
    expect(isAnswered("ordering", [2, 0, 1])).toBe(true);
  });
});

describe("danh mục loại câu hỏi", () => {
  it("mọi loại đều có nhãn tiếng Việt", () => {
    QUESTION_KINDS.forEach((k) => {
      expect(KIND_LABEL[k.value]).toBeTruthy();
      expect(k.hint.length).toBeGreaterThan(10);
    });
    expect(QUESTION_KINDS).toHaveLength(6);
  });
});
