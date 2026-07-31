import { describe, expect, it } from "vitest";

import { classifyVersion, createClockSync, sampleSkew } from "./clock";
import { createDiagLog, formatDiagReport } from "./diagnostics";

describe("hiệu chỉnh lệch đồng hồ", () => {
  it("bù một nửa RTT khi tính độ lệch", () => {
    // Client gửi lúc 1000, nhận lúc 1200 (RTT 200ms), máy chủ báo 5100.
    // Thời điểm máy chủ tương ứng lúc nhận ≈ 5100 + 100 = 5200 → lệch 4000ms.
    expect(sampleSkew({ sentAt: 1000, receivedAt: 1200, serverNow: 5100 })).toBe(4000);
  });

  it("đồng hồ không lệch thì skew xấp xỉ 0", () => {
    const c = createClockSync();
    c.push({ sentAt: 1000, receivedAt: 1100, serverNow: 1050 });
    expect(Math.abs(c.skew())).toBeLessThan(1);
  });

  it("làm mượt nhiều mẫu và đổi được mốc máy chủ sang mốc client", () => {
    const c = createClockSync(0.5);
    c.push({ sentAt: 0, receivedAt: 100, serverNow: 3050 }); // lệch 3000
    c.push({ sentAt: 0, receivedAt: 100, serverNow: 3250 }); // lệch 3200
    expect(c.skew()).toBeCloseTo(3100, 0);
    expect(c.toClient(10_000)).toBeCloseTo(6900, 0);
    expect(c.samples()).toBe(2);
  });

  it("bỏ qua mẫu có RTT quá lớn để không kéo lệch ước lượng", () => {
    const c = createClockSync();
    c.push({ sentAt: 0, receivedAt: 100, serverNow: 1050 });
    const before = c.skew();
    c.push({ sentAt: 0, receivedAt: 9000, serverNow: 900_000 });
    expect(c.skew()).toBe(before);
    expect(c.rtt()).toBe(9000);
  });
});

describe("chống gói trùng / tới muộn", () => {
  it("chấp nhận mọi gói khi chưa có trạng thái", () => {
    expect(classifyVersion(-1, 0)).toBe("apply");
  });
  it("chấp nhận phiên bản mới hơn", () => {
    expect(classifyVersion(4, 5)).toBe("apply");
  });
  it("bỏ gói trùng", () => {
    expect(classifyVersion(5, 5)).toBe("duplicate");
  });
  it("bỏ gói tới muộn", () => {
    expect(classifyVersion(5, 3)).toBe("stale");
  });
});

describe("nhật ký sự cố", () => {
  it("giữ tối đa N mục gần nhất", () => {
    const log = createDiagLog(3);
    for (let i = 0; i < 5; i += 1) log.push("error", `lỗi ${i}`);
    expect(log.list()).toHaveLength(3);
    expect(log.list()[0]!.message).toBe("lỗi 2");
  });

  it("kết xuất báo cáo có mã ván và nội dung sự cố", () => {
    const log = createDiagLog();
    log.push("reconnect", "Đã kết nối lại kênh realtime");
    const text = formatDiagReport({ duelId: "abc", ping: 120, skew: 40, reconnects: 1 }, log.list());
    expect(text).toContain("abc");
    expect(text).toContain("Kết nối lại");
    expect(text).toContain("120ms");
  });

  it("báo cáo rỗng vẫn đọc được", () => {
    expect(formatDiagReport({ duelId: "x" }, [])).toContain("không có sự cố");
  });
});
