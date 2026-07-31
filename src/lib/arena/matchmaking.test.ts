import { describe, expect, it } from "vitest";

import { eloSpread, levelSpread, matchScore, pickBestRoom } from "@/lib/arena/matchmaking";

const seeker = { employeeId: "me", elo: 1000, level: 5 };

describe("ghép trận đấu trường", () => {
  it("nới biên độ theo thời gian chờ", () => {
    expect(eloSpread(0)).toBe(150);
    expect(eloSpread(20)).toBe(300);
    expect(eloSpread(45)).toBe(Number.POSITIVE_INFINITY);
    expect(levelSpread(0)).toBe(2);
    expect(levelSpread(45)).toBe(Number.POSITIVE_INFINITY);
  });

  it("chọn đối thủ cùng trình nhất chứ không phải phòng đầu tiên", () => {
    const now = Date.now();
    const best = pickBestRoom(
      seeker,
      [
        { duelId: "a", employeeId: "x", elo: 1120, level: 7, createdAt: new Date(now).toISOString() },
        { duelId: "b", employeeId: "y", elo: 1010, level: 5, createdAt: new Date(now).toISOString() },
      ],
      0,
      now,
    );
    expect(best?.duelId).toBe("b");
  });

  it("bỏ qua chính mình và người lệch trình quá xa", () => {
    const now = Date.now();
    expect(
      pickBestRoom(seeker, [{ duelId: "a", employeeId: "me", elo: 1000, level: 5 }], 0, now),
    ).toBeNull();
    expect(
      pickBestRoom(seeker, [{ duelId: "a", employeeId: "z", elo: 1400, level: 10 }], 0, now),
    ).toBeNull();
  });

  it("chấp nhận mọi đối thủ khi đã chờ quá 30 giây", () => {
    const now = Date.now();
    const best = pickBestRoom(seeker, [{ duelId: "a", employeeId: "z", elo: 1900, level: 10 }], 40, now);
    expect(best?.duelId).toBe("a");
  });

  it("ưu tiên nhẹ phòng đã chờ lâu khi hai đối thủ ngang trình", () => {
    const now = Date.now();
    const fresh = { duelId: "fresh", employeeId: "a", elo: 1000, level: 5, createdAt: new Date(now).toISOString() };
    const old = { duelId: "old", employeeId: "b", elo: 1000, level: 5, createdAt: new Date(now - 90_000).toISOString() };
    expect(matchScore(seeker, old, now)).toBeLessThan(matchScore(seeker, fresh, now));
    expect(pickBestRoom(seeker, [fresh, old], 0, now)?.duelId).toBe("old");
  });
});
