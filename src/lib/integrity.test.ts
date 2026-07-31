import { describe, expect, it } from "vitest";

import {
  DISQUALIFY_THRESHOLD_DEFAULT,
  isExamEventKind,
  scoreEvent,
  shouldDisqualify,
} from "./integrity";

describe("scoreEvent", () => {
  it("bỏ qua việc ẩn tab dưới 3 giây (thông báo, cuộc gọi chớp nhoáng, xoay màn hình)", () => {
    expect(scoreEvent("tab_hidden", { hiddenMs: 0 })).toBe(0);
    expect(scoreEvent("tab_hidden", { hiddenMs: 2_000 })).toBe(0);
    expect(scoreEvent("tab_hidden", { hiddenMs: 2_999 })).toBe(0);
    expect(scoreEvent("tab_hidden", {})).toBe(0);
  });

  it("phạt 2 điểm khi ẩn tab 3–15 giây", () => {
    expect(scoreEvent("tab_hidden", { hiddenMs: 3_000 })).toBe(2);
    expect(scoreEvent("tab_hidden", { hiddenMs: 15_000 })).toBe(2);
  });

  it("phạt 4 điểm khi ẩn tab hơn 15 giây", () => {
    expect(scoreEvent("tab_hidden", { hiddenMs: 15_001 })).toBe(4);
    expect(scoreEvent("tab_hidden", { hiddenMs: 120_000 })).toBe(4);
  });

  it("không phạt window_blur khi trang vẫn hiển thị", () => {
    expect(scoreEvent("window_blur", { documentVisible: true })).toBe(0);
    expect(scoreEvent("window_blur", {})).toBe(0);
  });

  it("phạt copy/paste 3 điểm, multi_tab 5 điểm, fullscreen_exit 2 điểm", () => {
    expect(scoreEvent("copy")).toBe(3);
    expect(scoreEvent("paste")).toBe(3);
    expect(scoreEvent("multi_tab")).toBe(5);
    expect(scoreEvent("fullscreen_exit")).toBe(2);
  });

  it("không phạt contextmenu và reconnect", () => {
    expect(scoreEvent("contextmenu")).toBe(0);
    expect(scoreEvent("reconnect")).toBe(0);
  });

  it("trả về 0 với loại sự kiện lạ", () => {
    expect(scoreEvent("khong_ton_tai")).toBe(0);
    expect(isExamEventKind("khong_ton_tai")).toBe(false);
    expect(isExamEventKind("copy")).toBe(true);
  });
});

describe("shouldDisqualify", () => {
  it("không bao giờ huỷ bài khi tắt chế độ nghiêm ngặt", () => {
    expect(shouldDisqualify(100, 6, false)).toBe(false);
  });

  it("huỷ bài khi chạm ngưỡng trong chế độ nghiêm ngặt", () => {
    expect(shouldDisqualify(5, 6, true)).toBe(false);
    expect(shouldDisqualify(6, 6, true)).toBe(true);
    expect(shouldDisqualify(9, 6, true)).toBe(true);
  });

  it("dùng ngưỡng mặc định khi ngưỡng không hợp lệ", () => {
    expect(shouldDisqualify(DISQUALIFY_THRESHOLD_DEFAULT, 0, true)).toBe(true);
    expect(shouldDisqualify(DISQUALIFY_THRESHOLD_DEFAULT - 1, 0, true)).toBe(false);
  });

  it("một cuộc gọi 2 giây trên điện thoại không đủ để bị huỷ bài", () => {
    const score = scoreEvent("tab_hidden", { hiddenMs: 2_000 }) + scoreEvent("window_blur", { documentVisible: true });
    expect(score).toBe(0);
    expect(shouldDisqualify(score, 6, true)).toBe(false);
  });
});
