import { describe, expect, it } from "vitest";
import { evaluateTurnstile, describeTurnstileCode } from "./verify";

describe("evaluateTurnstile", () => {
  it("chấp nhận khi Cloudflare trả success", () => {
    expect(evaluateTurnstile({ success: true, action: "start-exam" }, "start-exam").ok).toBe(true);
  });

  it("từ chối khi không có phản hồi", () => {
    const v = evaluateTurnstile(null);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("thất bại");
  });

  it("diễn giải mã lỗi sang tiếng Việt", () => {
    const v = evaluateTurnstile({ success: false, "error-codes": ["timeout-or-duplicate"] });
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("đã dùng rồi");
    expect(v.codes).toEqual(["timeout-or-duplicate"]);
  });

  it("từ chối khi sai hành động", () => {
    const v = evaluateTurnstile({ success: true, action: "login" }, "start-exam");
    expect(v.ok).toBe(false);
    expect(v.codes).toEqual(["action-mismatch"]);
  });

  it("giữ nguyên mã lạ", () => {
    expect(describeTurnstileCode("unknown-x")).toBe("unknown-x");
  });
});

describe("evaluateTurnstile — tên miền và tuổi token", () => {
  it("từ chối token phát hành từ tên miền lạ", () => {
    const v = evaluateTurnstile(
      { success: true, action: "start-exam", hostname: "evil.example" },
      { action: "start-exam", hostnames: ["vatm.app"] },
    );
    expect(v.ok).toBe(false);
    expect(v.codes).toEqual(["hostname-mismatch"]);
  });

  it("chấp nhận tên miền con hợp lệ", () => {
    const v = evaluateTurnstile(
      { success: true, action: "start-exam", hostname: "thi.vatm.app" },
      { action: "start-exam", hostnames: ["vatm.app"] },
    );
    expect(v.ok).toBe(true);
  });

  it("từ chối token quá hạn", () => {
    const v = evaluateTurnstile(
      { success: true, action: "start-exam", challenge_ts: "2026-01-01T00:00:00.000Z" },
      { action: "start-exam", maxAgeMs: 60_000, nowMs: Date.parse("2026-01-01T00:10:00.000Z") },
    );
    expect(v.ok).toBe(false);
    expect(v.codes).toEqual(["token-expired"]);
  });

  it("từ chối khi thiếu action mà đề yêu cầu", () => {
    expect(evaluateTurnstile({ success: true }, { action: "exam-guard" }).ok).toBe(false);
  });
});
