import { describe, expect, it } from "vitest";

import {
  SIGN_MAX_SKEW_MS,
  checkMessage,
  isFreshStamp,
  saveMessage,
  signatureEnforced,
} from "@/lib/exam/payloadSign";

describe("payloadSign", () => {
  it("thông điệp gắn chặt với phiên, seq, mắt xích và mốc thời gian", () => {
    const base = { sessionId: "s1", seq: 3, chainPrev: "a".repeat(64), delta: { "0": 1 }, at: 100 };
    expect(saveMessage(base)).toContain("exam-save:v1|s1|3|");
    expect(saveMessage(base)).not.toEqual(saveMessage({ ...base, seq: 4 }));
    expect(saveMessage(base)).not.toEqual(saveMessage({ ...base, at: 101 }));
    expect(saveMessage(base)).not.toEqual(saveMessage({ ...base, delta: { "0": 2 } }));
  });

  it("thứ tự khoá trong gói không làm đổi thông điệp", () => {
    const a = saveMessage({ sessionId: "s", seq: 1, chainPrev: "x", delta: { "1": 1, "0": 2 }, at: 5 });
    const b = saveMessage({ sessionId: "s", seq: 1, chainPrev: "x", delta: { "0": 2, "1": 1 }, at: 5 });
    expect(a).toEqual(b);
  });

  it("thông điệp chấm ngay phân biệt theo câu và giá trị", () => {
    const m = checkMessage({ sessionId: "s", index: 2, value: 1, at: 9 });
    expect(m).not.toEqual(checkMessage({ sessionId: "s", index: 2, value: 2, at: 9 }));
  });

  it("chỉ nhận mốc thời gian trong cửa sổ cho phép", () => {
    const now = 1_000_000;
    expect(isFreshStamp(now, now)).toBe(true);
    expect(isFreshStamp(now - SIGN_MAX_SKEW_MS + 1, now)).toBe(true);
    expect(isFreshStamp(now - SIGN_MAX_SKEW_MS - 1, now)).toBe(false);
    expect(isFreshStamp(undefined, now)).toBe(false);
  });

  it("giai đoạn chuyển tiếp: chưa tới mốc thì chưa chặn", () => {
    expect(signatureEnforced("2026-08-01T00:00:00.000Z")).toBe(false);
    expect(signatureEnforced("2026-09-01T00:00:00.000Z")).toBe(true);
  });
});
