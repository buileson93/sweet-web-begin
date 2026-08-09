import { describe, expect, it } from "vitest";

import { durationMsOf, formatDuration, formatDurationOf } from "@/lib/format";

describe("formatDuration", () => {
  it("hiển thị 00:00.000 khi chưa có thời gian", () => {
    expect(formatDuration(0)).toBe("00:00.000");
  });

  it("hiển thị đúng phần mili-giây dưới 1 giây", () => {
    expect(formatDuration(937)).toBe("00:00.937");
  });

  it("hiển thị đúng mốc phút chẵn", () => {
    expect(formatDuration(120_000)).toBe("02:00.000");
  });

  it("vẫn hiển thị được khi vượt 60 phút", () => {
    expect(formatDuration(3_723_456)).toBe("62:03.456");
  });
});

describe("durationMsOf", () => {
  it("dùng time_ms khi có", () => {
    expect(durationMsOf({ time_ms: 12_345, time_seconds: 12 })).toBe(12_345);
    expect(formatDurationOf({ time_ms: 12_345 })).toBe("00:12.345");
  });

  it("quy đổi từ giây với dữ liệu cũ", () => {
    expect(durationMsOf({ time_seconds: 90 })).toBe(90_000);
    expect(formatDurationOf({ time_ms: null, time_seconds: 90 })).toBe("01:30.000");
  });
});
