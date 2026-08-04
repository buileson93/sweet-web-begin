import { describe, expect, it } from "vitest";

import {
  automationSignals,
  coefficientOfVariation,
  isRoboticTiming,
  unprovenKeys,
} from "@/lib/exam/scriptDetect";

describe("unprovenKeys", () => {
  it("bỏ qua khi máy khách không gửi bằng chứng (tương thích ngược)", () => {
    expect(unprovenKeys(["0", "1"], undefined)).toEqual([]);
  });

  it("chỉ ra câu không có thao tác thật", () => {
    const proofs = { "0": { trusted: true }, "1": { trusted: false } };
    expect(unprovenKeys(["0", "1", "2"], proofs)).toEqual(["1", "2"]);
  });
});

describe("nhịp bấm", () => {
  it("hệ số biến thiên bằng 0 khi các khoảng đều nhau", () => {
    expect(coefficientOfVariation([100, 100, 100])).toBe(0);
  });

  it("phát hiện nhịp đều như máy", () => {
    expect(isRoboticTiming([0, 200, 400, 600, 800, 1000])).toBe(true);
  });

  it("không bắt oan người thật (nhịp lệch nhiều)", () => {
    expect(isRoboticTiming([0, 1500, 4200, 5000, 9000, 15000])).toBe(false);
  });

  it("cần đủ số mẫu mới kết luận", () => {
    expect(isRoboticTiming([0, 100, 200])).toBe(false);
  });
});

describe("automationSignals", () => {
  it("không báo gì với trình duyệt bình thường", () => {
    expect(
      automationSignals({
        webdriver: false,
        userAgent: "Mozilla/5.0 (iPhone) Safari",
        languages: ["vi"],
        plugins: 0,
      }),
    ).toEqual([]);
  });

  it("bắt được webdriver, headless và biến toàn cục của trình điều khiển", () => {
    const signals = automationSignals({
      webdriver: true,
      userAgent: "HeadlessChrome/120",
      languages: [],
      driverGlobals: ["cdc_asdjflasutopfhvcZLmcfl_"],
      automationApis: ["__playwright"],
    });
    expect(signals).toEqual(["webdriver", "ua", "no_languages", "driver_globals", "automation_api"]);
  });
});
