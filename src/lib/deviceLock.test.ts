import { describe, expect, it } from "vitest";

import { deviceCooldownMessage, humanizeWait, maskName } from "@/lib/deviceLock";

describe("maskName", () => {
  it("rút gọn họ tên", () => {
    expect(maskName("Nguyễn Văn An")).toBe("N. V. An");
  });
  it("giữ nguyên tên một chữ", () => {
    expect(maskName("An")).toBe("An");
  });
  it("xử lý tên rỗng", () => {
    expect(maskName("   ")).toBe("một thí sinh khác");
  });
});

describe("humanizeWait", () => {
  it("dưới một phút", () => {
    expect(humanizeWait(45)).toBe("45 giây");
  });
  it("tròn phút", () => {
    expect(humanizeWait(120)).toBe("2 phút");
  });
  it("phút lẻ giây", () => {
    expect(humanizeWait(125)).toBe("2 phút 5 giây");
  });
  it("không âm", () => {
    expect(humanizeWait(-10)).toBe("0 giây");
  });
});

describe("deviceCooldownMessage", () => {
  it("nêu rõ người giữ thiết bị và thời gian chờ", () => {
    const msg = deviceCooldownMessage(1800, "Trần Thị Bình");
    expect(msg).toContain("T. T. Bình");
    expect(msg).toContain("30 phút");
    expect(msg).toContain("thi hộ");
  });
});
