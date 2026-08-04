import { describe, expect, it } from "vitest";

import {
  DEVTOOLS_SIZE_GAP,
  createConsoleBait,
  isDevtoolsBySize,
  isInspectShortcut,
} from "./antiInspect";

describe("isDevtoolsBySize", () => {
  it("cửa sổ bình thường không bị coi là mở DevTools", () => {
    expect(
      isDevtoolsBySize({ outerWidth: 1440, innerWidth: 1440, outerHeight: 900, innerHeight: 820 }),
    ).toBe(false);
  });

  it("phát hiện khi khung nhìn hụt nhiều theo chiều ngang hoặc dọc", () => {
    expect(
      isDevtoolsBySize({ outerWidth: 1440, innerWidth: 1000, outerHeight: 900, innerHeight: 880 }),
    ).toBe(true);
    expect(
      isDevtoolsBySize({
        outerWidth: 1440,
        innerWidth: 1440,
        outerHeight: 900,
        innerHeight: 900 - DEVTOOLS_SIZE_GAP - 1,
      }),
    ).toBe(true);
  });
});

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
