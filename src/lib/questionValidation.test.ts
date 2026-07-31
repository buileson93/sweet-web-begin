import { describe, expect, it } from "vitest";

import {
  MAX_TIME_LIMIT_SECONDS,
  firstErrorMessage,
  hasBlockingErrors,
  parseAcceptedAnswers,
  parseTimeLimit,
  validateQuestionDraft,
  type QuestionDraftInput,
} from "./questionValidation";

function draft(over: Partial<QuestionDraftInput> = {}): QuestionDraftInput {
  return {
    question: "Sân bay Đà Nẵng có mã ICAO là gì?",
    kind: "single",
    options: ["VVDN", "VVNB", "VVTS", "VVCR"],
    correct_index: 0,
    correct_indices: [],
    accepted_answers: "",
    pairs: [],
    points: 1,
    time_limit_seconds: "",
    ...over,
  };
}

describe("parseTimeLimit", () => {
  it("coi rỗng, 0 và giá trị sai là dùng thời gian chung", () => {
    expect(parseTimeLimit("")).toBeNull();
    expect(parseTimeLimit(0)).toBeNull();
    expect(parseTimeLimit(null)).toBeNull();
    expect(parseTimeLimit("abc")).toBeNull();
  });
  it("chặn trần 600 giây và làm tròn", () => {
    expect(parseTimeLimit(45)).toBe(45);
    expect(parseTimeLimit("45.6")).toBe(46);
    expect(parseTimeLimit(9999)).toBe(MAX_TIME_LIMIT_SECONDS);
  });
});

describe("parseAcceptedAnswers", () => {
  it("tách theo dòng và bỏ dòng rỗng", () => {
    expect(parseAcceptedAnswers(" a \n\n b\n")).toEqual(["a", "b"]);
  });
});

describe("validateQuestionDraft — chung", () => {
  it("báo lỗi nội dung quá ngắn", () => {
    const r = validateQuestionDraft(draft({ question: "abc" }));
    expect(r.errors.question).toContain("quá ngắn");
    expect(hasBlockingErrors(r)).toBe(true);
    expect(firstErrorMessage(r)).toBeTruthy();
  });

  it("cảnh báo khi trùng nội dung với câu đã có trong cùng cuộc thi", () => {
    const r = validateQuestionDraft(draft(), [
      { id: "x", question: "sân bay đà nẵng có mã ICAO là gì" },
    ]);
    expect(r.warnings.question).toContain("trùng nội dung");
    expect(hasBlockingErrors(r)).toBe(false);
  });

  it("không tự cảnh báo trùng với chính câu đang sửa", () => {
    const r = validateQuestionDraft(
      draft(),
      [{ id: "me", question: "Sân bay Đà Nẵng có mã ICAO là gì?" }],
      "me",
    );
    expect(r.warnings.question).toBeUndefined();
  });

  it("báo lỗi điểm và thời gian không hợp lệ", () => {
    expect(validateQuestionDraft(draft({ points: 0 })).errors.points).toBeTruthy();
    expect(
      validateQuestionDraft(draft({ time_limit_seconds: 900 })).errors.time_limit_seconds,
    ).toContain("600");
    expect(validateQuestionDraft(draft({ time_limit_seconds: 45 })).errors.time_limit_seconds)
      .toBeUndefined();
  });
});

describe("validateQuestionDraft — single / true_false", () => {
  it("chấp nhận câu hợp lệ", () => {
    expect(hasBlockingErrors(validateQuestionDraft(draft()))).toBe(false);
  });
  it("bắt buộc ít nhất 2 phương án", () => {
    const r = validateQuestionDraft(draft({ options: ["A", ""], correct_index: 0 }));
    expect(r.errors.options).toContain("ít nhất 2");
  });
  it("bắt lỗi phương án trùng nhau", () => {
    const r = validateQuestionDraft(draft({ options: ["VVDN", "vvdn", "X", "Y"] }));
    expect(r.errors.options).toContain("trùng");
  });
  it("bắt lỗi chưa chọn đáp án đúng", () => {
    const r = validateQuestionDraft(draft({ correct_index: 9 }));
    expect(r.errors.correct).toContain("một phương án đúng");
  });
  it("áp dụng cùng luật cho đúng/sai", () => {
    const ok = validateQuestionDraft(
      draft({ kind: "true_false", options: ["Đúng", "Sai"], correct_index: 1 }),
    );
    expect(hasBlockingErrors(ok)).toBe(false);
  });
});

describe("validateQuestionDraft — multi", () => {
  it("bắt buộc chọn ít nhất một đáp án đúng", () => {
    const r = validateQuestionDraft(draft({ kind: "multi", correct_indices: [] }));
    expect(r.errors.correct).toContain("ít nhất một");
  });
  it("cảnh báo khi chọn đúng tất cả", () => {
    const r = validateQuestionDraft(draft({ kind: "multi", correct_indices: [0, 1, 2, 3] }));
    expect(hasBlockingErrors(r)).toBe(false);
    expect(r.warnings.correct).toContain("TẤT CẢ");
  });
  it("chấp nhận chọn một phần", () => {
    const r = validateQuestionDraft(draft({ kind: "multi", correct_indices: [0, 2] }));
    expect(hasBlockingErrors(r)).toBe(false);
    expect(r.warnings.correct).toBeUndefined();
  });
});

describe("validateQuestionDraft — fill_blank", () => {
  it("bắt buộc ít nhất một đáp án chấp nhận", () => {
    const r = validateQuestionDraft(draft({ kind: "fill_blank", accepted_answers: "  \n " }));
    expect(r.errors.accepted_answers).toContain("ít nhất một");
  });
  it("cảnh báo đáp án trùng sau khi chuẩn hoá", () => {
    const r = validateQuestionDraft(
      draft({ kind: "fill_blank", accepted_answers: "Đà Nẵng\nda nang" }),
    );
    expect(hasBlockingErrors(r)).toBe(false);
    expect(r.warnings.accepted_answers).toContain("trùng");
  });
});

describe("validateQuestionDraft — matching", () => {
  const pairs = [
    { left: "VVDN", right: "Đà Nẵng" },
    { left: "VVTS", right: "Tân Sơn Nhất" },
  ];
  it("bắt buộc tối thiểu 2 cặp", () => {
    const r = validateQuestionDraft(draft({ kind: "matching", pairs: [pairs[0]] }));
    expect(r.errors.pairs).toContain("ít nhất 2");
  });
  it("bắt lỗi cặp thiếu một vế", () => {
    const r = validateQuestionDraft(
      draft({ kind: "matching", pairs: [pairs[0], { left: "VVTS", right: " " }] }),
    );
    expect(r.errors.pairs).toContain("thiếu nội dung");
  });
  it("cảnh báo cột phải trùng giá trị", () => {
    const r = validateQuestionDraft(
      draft({
        kind: "matching",
        pairs: [pairs[0], { left: "VVTS", right: "đà nẵng" }],
      }),
    );
    expect(hasBlockingErrors(r)).toBe(false);
    expect(r.warnings.pairs).toContain("trùng");
  });
  it("chấp nhận cặp hợp lệ", () => {
    expect(hasBlockingErrors(validateQuestionDraft(draft({ kind: "matching", pairs })))).toBe(false);
  });
});

describe("validateQuestionDraft — ordering", () => {
  it("bắt buộc tối thiểu 3 mục", () => {
    const r = validateQuestionDraft(draft({ kind: "ordering", options: ["1", "2"] }));
    expect(r.errors.options).toContain("ít nhất 3");
  });
  it("chấp nhận 3 mục khác nhau", () => {
    const r = validateQuestionDraft(draft({ kind: "ordering", options: ["1", "2", "3"] }));
    expect(hasBlockingErrors(r)).toBe(false);
  });
  it("bắt lỗi mục trùng nhau", () => {
    const r = validateQuestionDraft(draft({ kind: "ordering", options: ["A", "a", "B"] }));
    expect(r.errors.options).toContain("trùng");
  });
});
