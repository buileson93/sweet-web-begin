import { describe, expect, it } from "vitest";

import { SUBMIT_GRACE_MS, lateness } from "@/lib/grading";

const base = "2026-07-31T10:00:00.000Z";
const plus = (ms: number) => new Date(Date.parse(base) + ms).toISOString();

describe("lateness", () => {
  it("nộp đúng hạn: chưa hết giờ", () => {
    expect(lateness(plus(-5_000), base)).toEqual({
      expired: false,
      msLate: 0,
      withinGrace: true,
    });
  });

  it("nộp đúng đúng thời điểm hết hạn", () => {
    const r = lateness(base, base);
    expect(r.expired).toBe(false);
    expect(r.msLate).toBe(0);
  });

  it("muộn 10s: còn trong ân hạn", () => {
    const r = lateness(plus(10_000), base);
    expect(r.msLate).toBe(10_000);
    expect(r.expired).toBe(true);
    expect(r.withinGrace).toBe(true);
  });

  it("muộn 45s: quá ân hạn", () => {
    const r = lateness(plus(45_000), base);
    expect(r.expired).toBe(true);
    expect(r.withinGrace).toBe(false);
  });

  it("ân hạn mặc định là 30 giây", () => {
    expect(SUBMIT_GRACE_MS).toBe(30_000);
  });

  it("expiresAt không hợp lệ: coi như đã hết hạn và hết ân hạn", () => {
    const r = lateness(base, "không-phải-ngày");
    expect(r.expired).toBe(true);
    expect(r.withinGrace).toBe(false);
  });

  it("nowIso không hợp lệ: coi như đã hết hạn", () => {
    expect(lateness("xxx", base).expired).toBe(true);
  });
});
