import { describe, expect, it } from "vitest";

import { PASS_PERCENT_DEFAULT, isPassed } from "@/lib/grading";

// Đơn vị điểm đạt duy nhất trong toàn hệ thống là PHẦN TRĂM (0–100).
describe("isPassed", () => {
  it("10/20 với 50% -> đạt", () => expect(isPassed(10, 20, 50)).toBe(true));
  it("9/20 với 50% -> chưa đạt", () => expect(isPassed(9, 20, 50)).toBe(false));

  it("đề 20 câu, passPercent=50 cần đúng 10 câu (ca bug cũ)", () => {
    // Trước đây so sánh số câu đúng >= 50 nên không ai đạt được.
    expect(isPassed(9, 20, 50)).toBe(false);
    expect(isPassed(10, 20, 50)).toBe(true);
    expect(isPassed(11, 20, 50)).toBe(true);
  });

  it("passPercent=100 phải đúng tuyệt đối", () => {
    expect(isPassed(20, 20, 100)).toBe(true);
    expect(isPassed(19, 20, 100)).toBe(false);
  });

  it("total = 0 -> luôn chưa đạt", () => {
    expect(isPassed(0, 0, 50)).toBe(false);
    expect(isPassed(5, 0, 0)).toBe(false);
  });

  it("passPercent <= 0 dùng mặc định 50%", () => {
    expect(PASS_PERCENT_DEFAULT).toBe(50);
    expect(isPassed(10, 20, 0)).toBe(true);
    expect(isPassed(9, 20, 0)).toBe(false);
    expect(isPassed(9, 20, -10)).toBe(false);
  });

  it("làm tròn theo Math.round giống percentOf", () => {
    // 2/3 = 66.67% -> làm tròn 67
    expect(isPassed(2, 3, 67)).toBe(true);
    expect(isPassed(2, 3, 68)).toBe(false);
  });
});
