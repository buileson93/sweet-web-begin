import { describe, expect, it } from "vitest";

import {
  DISQUALIFY_THRESHOLD_DEFAULT,
  isExamEventKind,
  isQuotaExempt,
  leaveAllowance,
  shouldForceRestart,
  MAX_EXEMPT_EVENTS_PER_SESSION,
  MAX_EVENTS_PER_SESSION,
  scoreEvent,
  shouldDisqualify,
} from "./integrity";

describe("scoreEvent", () => {
  it("bỏ qua việc ẩn tab dưới 1,5 giây (thông báo, xoay màn hình)", () => {
    expect(scoreEvent("tab_hidden", { hiddenMs: 0 })).toBe(0);
    expect(scoreEvent("tab_hidden", { hiddenMs: 1_000 })).toBe(0);
    expect(scoreEvent("tab_hidden", { hiddenMs: 1_499 })).toBe(0);
    expect(scoreEvent("tab_hidden", {})).toBe(0);
  });

  it("phạt 2 điểm khi ẩn tab 1,5–15 giây", () => {
    expect(scoreEvent("tab_hidden", { hiddenMs: 1_500 })).toBe(2);
    expect(scoreEvent("tab_hidden", { hiddenMs: 3_000 })).toBe(2);
    expect(scoreEvent("tab_hidden", { hiddenMs: 15_000 })).toBe(2);
  });

  it("phạt 4 điểm khi ẩn tab hơn 15 giây", () => {
    expect(scoreEvent("tab_hidden", { hiddenMs: 15_001 })).toBe(4);
    expect(scoreEvent("tab_hidden", { hiddenMs: 120_000 })).toBe(4);
  });

  it("window_blur: bỏ qua khi ngắn, phạt nhẹ khi mất focus kéo dài", () => {
    expect(scoreEvent("window_blur", { documentVisible: true })).toBe(0);
    expect(scoreEvent("window_blur", {})).toBe(0);
    expect(scoreEvent("window_blur", { documentVisible: true, blurredMs: 4_000 })).toBe(1);
    expect(scoreEvent("window_blur", { documentVisible: false })).toBe(2);
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

  it("một thông báo chớp nhoáng (1 giây) không đủ để bị huỷ bài", () => {
    const score =
      scoreEvent("tab_hidden", { hiddenMs: 1_000 }) +
      scoreEvent("window_blur", { documentVisible: true });
    expect(score).toBe(0);
    expect(shouldDisqualify(score, 6, true)).toBe(false);
  });
});

describe("quota sự kiện", () => {
  it("miễn quota cho hai loại nặng nhất để không bị đốt bởi copy/paste", () => {
    expect(isQuotaExempt("tab_hidden")).toBe(true);
    expect(isQuotaExempt("multi_tab")).toBe(true);
    expect(isQuotaExempt("copy")).toBe(false);
    expect(isQuotaExempt("window_blur")).toBe(false);
  });

  it("quota riêng của loại được miễn rộng hơn quota chung", () => {
    expect(MAX_EXEMPT_EVENTS_PER_SESSION).toBeGreaterThan(MAX_EVENTS_PER_SESSION);
  });
});

describe("chính sách rời màn hình", () => {
  it("máy tính: rời 1 lần là buộc thi lại", () => {
    expect(leaveAllowance(false)).toBe(0);
    expect(shouldForceRestart(1, false)).toBe(true);
  });
  it("điện thoại: tha lần đầu, lần thứ hai buộc thi lại", () => {
    expect(leaveAllowance(true)).toBe(1);
    expect(shouldForceRestart(1, true)).toBe(false);
    expect(shouldForceRestart(2, true)).toBe(true);
  });
});
