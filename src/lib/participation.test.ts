import { describe, expect, it } from "vitest";

import { countdownParts, formatCountdown, msUntil } from "@/lib/countdown";
import { splitParticipation } from "@/lib/participation";

describe("countdownParts", () => {
  it("tách đúng ngày giờ phút giây", () => {
    const p = countdownParts((2 * 86400 + 3 * 3600 + 14 * 60 + 5) * 1000);
    expect(p).toMatchObject({ days: 2, hours: 3, minutes: 14, seconds: 5, done: false });
  });
  it("về 0 khi đã qua hạn", () => {
    expect(countdownParts(-5000)).toMatchObject({ days: 0, seconds: 0, done: true });
  });
});

describe("formatCountdown", () => {
  it("có ngày", () => {
    expect(formatCountdown((86400 + 3661) * 1000)).toBe("1 ngày 01:01:01");
  });
  it("chỉ đồng hồ khi dưới một ngày", () => {
    expect(formatCountdown(65 * 1000)).toBe("00:01:05");
  });
  it("báo đã tới giờ", () => {
    expect(formatCountdown(0)).toBe("Đã tới giờ");
  });
});

describe("msUntil", () => {
  it("trả null khi thiếu mốc", () => {
    expect(msUntil(null)).toBeNull();
    expect(msUntil("không-phải-ngày")).toBeNull();
  });
  it("tính đúng khoảng cách", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    expect(msUntil("2026-01-01T00:01:00Z", now)).toBe(60000);
  });
});

const roster = [
  { id: "a", full_name: "Nguyễn Văn A", unit_name: "Đội 1" },
  { id: "b", full_name: "Trần Thị B", unit_name: null },
  { id: "c", full_name: "Lê Văn C", unit_name: "Đội 2" },
];

describe("splitParticipation", () => {
  it("chia đúng nhóm đã thi và chưa thi", () => {
    const r = splitParticipation(roster, [
      { employee_id: "a", points: 8, question_ids: new Array(10).fill(""), submitted_at: "2026-01-02T00:00:00Z" },
      { employee_id: "a", points: 5, question_ids: new Array(10).fill(""), submitted_at: "2026-01-03T00:00:00Z" },
    ]);
    expect(r.doneCount).toBe(1);
    expect(r.pendingCount).toBe(2);
    expect(r.done[0]).toMatchObject({ attempts: 2, bestScore: 8, lastAt: "2026-01-03T00:00:00Z" });
    expect(r.percent).toBe(33);
  });

  it("bỏ qua lượt thi không gắn nhân viên", () => {
    const r = splitParticipation(roster, [
      { employee_id: null, points: 9, question_ids: new Array(10).fill(""), submitted_at: "2026-01-02T00:00:00Z" },
    ]);
    expect(r.doneCount).toBe(0);
  });

  it("đơn vị trống hiển thị Chưa cập nhật", () => {
    const r = splitParticipation(roster, []);
    expect(r.pending.some((p) => p.unit === "Chưa cập nhật")).toBe(true);
  });

  it("danh sách rỗng cho phần trăm 0", () => {
    expect(splitParticipation([], []).percent).toBe(0);
  });
});
