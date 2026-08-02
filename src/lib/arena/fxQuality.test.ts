import { describe, expect, it } from "vitest";

import { qualityFromFps } from "./fxQuality";

describe("qualityFromFps", () => {
  it("ưu tiên giảm chuyển động", () => {
    expect(qualityFromFps(60, true)).toBe("min");
  });
  it("phân bậc theo FPS", () => {
    expect(qualityFromFps(58, false)).toBe("high");
    expect(qualityFromFps(35, false)).toBe("low");
    expect(qualityFromFps(18, false)).toBe("min");
  });
});
