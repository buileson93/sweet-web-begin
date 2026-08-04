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
