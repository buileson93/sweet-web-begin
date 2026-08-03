import { describe, expect, it } from "vitest";
import { bulkSubmitPenalty, bulkSubmitReason } from "./humanPresence";

describe("bulkSubmitPenalty", () => {
  it("phạt nặng khi toàn bộ đáp án đến trong một lần lưu và thời gian cực ngắn", () => {
    expect(bulkSubmitPenalty({ answered: 20, answersSeq: 1, timeSeconds: 4 })).toBe(12);
  });

  it("phạt khi đáp án dồn cục (20 câu / 2 lần lưu) trong thời gian không thể đọc hết đề", () => {
    expect(bulkSubmitPenalty({ answered: 20, answersSeq: 2, timeSeconds: 30 })).toBe(8);
  });

  it("KHÔNG phạt người mạng chập chờn: ít lần lưu nhưng làm đủ thời gian", () => {
    expect(bulkSubmitPenalty({ answered: 20, answersSeq: 1, timeSeconds: 600 })).toBe(0);
  });

  it("KHÔNG phạt người thi nhanh thật với số lần lưu bình thường", () => {
    expect(bulkSubmitPenalty({ answered: 20, answersSeq: 18, timeSeconds: 35 })).toBe(0);
  });

  it("bỏ qua bài quá ngắn", () => {
    expect(bulkSubmitPenalty({ answered: 3, answersSeq: 1, timeSeconds: 1 })).toBe(0);
  });

  it("bỏ qua dữ liệu không hợp lệ", () => {
    expect(bulkSubmitPenalty({ answered: Number.NaN, answersSeq: 1, timeSeconds: 1 })).toBe(0);
  });

  it("lý do nêu rõ số câu, số lần lưu và thời gian", () => {
    expect(bulkSubmitReason({ answered: 20, answersSeq: 1, timeSeconds: 4 })).toContain(
      "20 câu / 1 lần lưu / 4s",
    );
  });
});
