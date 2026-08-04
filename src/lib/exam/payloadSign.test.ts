import { describe, expect, it } from "vitest";

import {
  PROOF_MAX_LAG_MS,
  SIGN_MAX_SKEW_MS,
  checkMessage,
  isFreshStamp,
  saveMessage,
  signatureEnforced,
  staleProofKeys,
} from "@/lib/exam/payloadSign";

describe("payloadSign", () => {
  it("thông điệp gắn chặt với phiên, seq, mắt xích và mốc thời gian", () => {
    const base = { sessionId: "s1", seq: 3, chainPrev: "a".repeat(64), delta: { "0": 1 }, at: 100 };
    expect(saveMessage(base)).toContain("exam-save:v2|s1|3|");
    expect(saveMessage(base)).not.toEqual(saveMessage({ ...base, seq: 4 }));
    expect(saveMessage(base)).not.toEqual(saveMessage({ ...base, at: 101 }));
    expect(saveMessage(base)).not.toEqual(saveMessage({ ...base, delta: { "0": 2 } }));
  });

  it("chữ ký bao trùm cả bằng chứng thao tác", () => {
    const base = { sessionId: "s1", seq: 1, chainPrev: "x", delta: { "0": 1 }, at: 100 };
    const honest = saveMessage({ ...base, proofs: { "0": { trusted: true, via: "pointer", at: 90 } } });
    const forged = saveMessage({ ...base, proofs: { "0": { trusted: false, via: "none", at: 90 } } });
    expect(honest).not.toEqual(forged);
    expect(saveMessage(base)).not.toEqual(honest);
  });

  it("thứ tự khoá trong gói không làm đổi thông điệp", () => {
    const a = saveMessage({ sessionId: "s", seq: 1, chainPrev: "x", delta: { "1": 1, "0": 2 }, at: 5 });
    const b = saveMessage({ sessionId: "s", seq: 1, chainPrev: "x", delta: { "0": 2, "1": 1 }, at: 5 });
    expect(a).toEqual(b);
  });

  it("thông điệp chấm ngay phân biệt theo câu, giá trị và bằng chứng", () => {
    const m = checkMessage({ sessionId: "s", index: 2, value: 1, at: 9 });
    expect(m).not.toEqual(checkMessage({ sessionId: "s", index: 2, value: 2, at: 9 }));
    expect(m).not.toEqual(
      checkMessage({ sessionId: "s", index: 2, value: 1, at: 9, proof: { trusted: true, at: 8 } }),
    );
  });

  it("chỉ nhận mốc thời gian trong cửa sổ cho phép", () => {
    const now = 1_000_000;
    expect(isFreshStamp(now, now)).toBe(true);
    expect(isFreshStamp(now - SIGN_MAX_SKEW_MS + 1, now)).toBe(true);
    expect(isFreshStamp(now - SIGN_MAX_SKEW_MS - 1, now)).toBe(false);
    expect(isFreshStamp(undefined, now)).toBe(false);
  });

  it("bắt buộc chữ ký theo đề thi (chế độ nghiêm ngặt), không theo ngày", () => {
    expect(signatureEnforced(true)).toBe(true);
    expect(signatureEnforced(false)).toBe(false);
    expect(signatureEnforced(null)).toBe(false);
  });

  it("bằng chứng thao tác phải sát thời điểm gói được gửi", () => {
    const at = 1_000_000;
    const proofs = {
      "0": { trusted: true, at: at - 1_000 },
      "1": { trusted: true, at: at - PROOF_MAX_LAG_MS - 1 },
      "2": { trusted: true },
      "3": { trusted: true, at: at + SIGN_MAX_SKEW_MS + 1 },
    };
    expect(staleProofKeys(proofs, at).sort()).toEqual(["1", "2", "3"]);
    expect(staleProofKeys(proofs, undefined)).toEqual([]);
  });
});

