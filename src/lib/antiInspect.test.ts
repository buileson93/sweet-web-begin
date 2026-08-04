import { describe, expect, it } from "vitest";

import { createConsoleBait, isInspectShortcut } from "./antiInspect";

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
