import { describe, expect, it } from "vitest";

import { buildDeviceSnapshot, pickClosestVisit, resolveSessionDevice } from "@/lib/exam/deviceSnapshot";

const REQ = { ip: "203.0.113.9", ipSource: "cf-connecting-ip", userAgent: "Mozilla/5.0 (iPhone) Safari" };
const CLIENT = {
  browser: "Safari",
  browser_version: "17.4",
  os: "iOS",
  os_version: "17.4",
  device_type: "mobile",
  device_model: "iPhone 13",
  screen_w: 390,
  screen_h: 844,
  viewport_w: 390,
  viewport_h: 700,
  pixel_ratio: 3,
  language: "vi-VN",
  timezone: "Asia/Ho_Chi_Minh",
  network_type: "4g",
  is_pwa: true,
  is_touch: true,
  user_agent: "Mozilla/5.0 (iPhone) Safari",
};

describe("ảnh chụp thiết bị của phiên thi", () => {
  it("máy chủ vẫn ghi IP và user-agent khi máy khách chặn hết dữ liệu thiết bị", () => {
    // Khách xoá cookie/localStorage hoặc chặn script thống kê → device rỗng.
    const snap = buildDeviceSnapshot(undefined, REQ, "2026-08-04T09:00:00.000Z");
    expect(snap.ip).toBe("203.0.113.9");
    expect(snap.ip_source).toBe("cf-connecting-ip");
    expect(snap.user_agent).toBe(REQ.userAgent);
    expect(snap.captured_at).toBe("2026-08-04T09:00:00.000Z");
  });

  it("không bao giờ trả về object rỗng, mọi khoá đều tồn tại", () => {
    const snap = buildDeviceSnapshot({}, {});
    const keys = Object.keys(snap);
    for (const k of ["ip", "user_agent", "browser", "os", "device_type", "screen", "timezone", "captured_at"]) {
      expect(keys).toContain(k);
    }
    expect(Object.keys(snap).length).toBeGreaterThan(0);
  });

  it("ghép đủ thông tin khi máy khách gửi dữ liệu", () => {
    const snap = buildDeviceSnapshot(CLIENT, REQ);
    expect(snap.screen).toBe("390×844");
    expect(snap.viewport).toBe("390×700");
    expect(snap.device_model).toBe("iPhone 13");
    expect(snap.is_pwa).toBe(true);
  });

  it("cắt chuỗi quá dài do máy khách cố tình nhồi dữ liệu", () => {
    const snap = buildDeviceSnapshot({ browser: "x".repeat(500), user_agent: "u".repeat(9000) }, REQ);
    expect(snap.browser).toHaveLength(40);
    expect(snap.user_agent).toHaveLength(400);
  });
});

describe("hiển thị thiết bị trong Theo dõi trực tiếp", () => {
  const startedAt = "2026-08-04T09:00:00.000Z";

  it("ưu tiên ảnh chụp trong phiên dù không có lượt truy cập nào (đã xoá cookie)", () => {
    const snap = buildDeviceSnapshot(CLIENT, REQ, startedAt);
    const device = resolveSessionDevice(snap, [], startedAt);
    expect(device).not.toBeNull();
    expect(device!.ip).toBe("203.0.113.9");
    expect(device!.browser).toBe("Safari 17.4");
    expect(device!.os).toBe("iOS 17.4");
    expect(device!.screen).toBe("390×844");
  });

  it("bỏ qua lượt truy cập của máy khác khi phiên đã có ảnh chụp (thí sinh chuyển máy)", () => {
    const snap = buildDeviceSnapshot(CLIENT, REQ, startedAt);
    const device = resolveSessionDevice(snap, [
      {
        ip: "10.0.0.1",
        browser: "Chrome",
        browser_version: "120",
        os: "Windows",
        device_type: "desktop",
        created_at: startedAt,
      },
    ], startedAt);
    expect(device!.ip).toBe("203.0.113.9");
    expect(device!.deviceType).toBe("mobile");
  });

  it("phiên cũ chưa có ảnh chụp thì lấy lượt truy cập gần giờ thi nhất", () => {
    const device = resolveSessionDevice({}, [
      { ip: "1.1.1.1", browser: "Chrome", created_at: "2026-08-04T05:00:00.000Z" },
      { ip: "2.2.2.2", browser: "Edge", screen_w: 1440, screen_h: 900, created_at: "2026-08-04T08:58:00.000Z" },
      { ip: "3.3.3.3", browser: "Firefox", created_at: "2026-08-05T09:00:00.000Z" },
    ], startedAt);
    expect(device!.ip).toBe("2.2.2.2");
    expect(device!.screen).toBe("1440×900");
  });

  it("không có ảnh chụp lẫn lượt truy cập thì trả null để UI báo thiếu dữ liệu", () => {
    expect(resolveSessionDevice(null, [], startedAt)).toBeNull();
    expect(resolveSessionDevice({}, null, startedAt)).toBeNull();
  });

  it("thiếu trường nào thì hiển thị dấu — thay vì để trống", () => {
    const device = resolveSessionDevice({ ip: "" , browser: "", captured_at: "" }, [], startedAt);
    expect(device!.ip).toBe("—");
    expect(device!.browser).toBe("—");
    expect(device!.seenAt).toBe(startedAt);
  });

  it("pickClosestVisit an toàn với danh sách rỗng", () => {
    expect(pickClosestVisit([], startedAt)).toBeNull();
    expect(pickClosestVisit(undefined, startedAt)).toBeNull();
  });
});
