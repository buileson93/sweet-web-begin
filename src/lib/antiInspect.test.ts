import { describe, expect, it } from "vitest";

import {
  createConsoleBait,
  createHitStreak,
  isDebuggerPause,
  isInspectShortcut,
} from "./antiInspect";

describe("isInspectShortcut", () => {
  const base = { ctrlKey: false, metaKey: false, shiftKey: false };
  it("chặn F12, Ctrl/Cmd+Shift+I/J/C/K và Ctrl+U", () => {
    expect(isInspectShortcut({ ...base, key: "F12" })).toBe(true);
    expect(isInspectShortcut({ ...base, ctrlKey: true, shiftKey: true, key: "I" })).toBe(true);
    expect(isInspectShortcut({ ...base, metaKey: true, shiftKey: true, key: "c" })).toBe(true);
    expect(isInspectShortcut({ ...base, ctrlKey: true, key: "u" })).toBe(true);
  });
  it("không chặn phím thường", () => {
    expect(isInspectShortcut({ ...base, key: "a" })).toBe(false);
    expect(isInspectShortcut({ ...base, ctrlKey: true, key: "i" })).toBe(false);
  });
});

describe("createConsoleBait", () => {
  it("không báo khi console không dựng bản xem trước (DevTools đóng)", () => {
    const bait = createConsoleBait();
    expect(bait.probe()).toBe(false);
  });
});

describe("isDebuggerPause", () => {
  it("không kết luận khi máy đang giật (nền cũng chậm)", () => {
    expect(isDebuggerPause(300, 200)).toBe(false);
    expect(isDebuggerPause(150, 40)).toBe(false);
  });
  it("chỉ báo khi debugger chậm hơn hẳn nền và vượt ngưỡng", () => {
    expect(isDebuggerPause(600, 0.2)).toBe(true);
    expect(isDebuggerPause(119, 0)).toBe(false);
  });
});

describe("createHitStreak", () => {
  it("phải dính liên tiếp đủ số lần mới báo", () => {
    const s = createHitStreak(3);
    expect(s.push(true)).toBe(false);
    expect(s.push(true)).toBe(false);
    expect(s.push(true)).toBe(true);
  });
  it("một lần trượt là đặt lại chuỗi", () => {
    const s = createHitStreak(3);
    s.push(true);
    s.push(false);
    expect(s.push(true)).toBe(false);
    expect(s.push(true)).toBe(false);
    expect(s.push(true)).toBe(true);
  });
});
