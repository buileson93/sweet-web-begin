import { describe, expect, it } from "vitest";

import {
  BASE_POINTS,
  decideWinner,
  eloDelta,
  eloTier,
  expectedScore,
  kFactor,
  remainingMs,
  roundPoints,
} from "./scoring";

describe("roundPoints", () => {
  it("trả lời sai luôn 0 điểm", () => {
    expect(roundPoints(false, 0, 20_000, 0)).toBe(0);
    expect(roundPoints(false, 0, 20_000, 9)).toBe(0);
  });

  it("trả lời đúng tức thì được 150 điểm", () => {
    expect(roundPoints(true, 0, 20_000, 0)).toBe(150);
  });

  it("trả lời đúng ngay lúc hết giờ được 100 điểm", () => {
    expect(roundPoints(true, 20_000, 20_000, 0)).toBe(BASE_POINTS);
  });

  it("thưởng tốc độ tuyến tính theo thời gian còn lại", () => {
    expect(roundPoints(true, 10_000, 20_000, 0)).toBe(125);
    expect(roundPoints(true, 15_000, 20_000, 0)).toBe(113);
  });

  it("kẹp msTaken âm về 0 và vượt hạn về đúng biên", () => {
    expect(roundPoints(true, -5_000, 20_000, 0)).toBe(150);
    expect(roundPoints(true, 99_000, 20_000, 0)).toBe(100);
    expect(roundPoints(true, Number.NaN, 20_000, 0)).toBe(150);
  });

  it("thưởng chuỗi +30 khi chuỗi đạt 3", () => {
    expect(roundPoints(true, 20_000, 20_000, 2)).toBe(100);
    expect(roundPoints(true, 20_000, 20_000, 3)).toBe(130);
    expect(roundPoints(true, 0, 20_000, 5)).toBe(180);
  });

  it("không bao giờ âm và chịu được limit = 0", () => {
    expect(roundPoints(true, 5, 0, 0)).toBeGreaterThanOrEqual(100);
  });
});

describe("eloDelta", () => {
  it("hai người 1000 điểm hoà nhau thì không đổi", () => {
    expect(eloDelta(1000, 1000, 0.5, 20)).toBe(0);
  });

  it("K = 48 khi dưới 10 trận, 32 khi từ 10 trận", () => {
    expect(kFactor(0)).toBe(48);
    expect(kFactor(9)).toBe(48);
    expect(kFactor(10)).toBe(32);
    expect(eloDelta(1000, 1000, 1, 0)).toBe(24);
    expect(eloDelta(1000, 1000, 1, 30)).toBe(16);
  });

  it("thắng người mạnh hơn được nhiều hơn thắng người yếu hơn", () => {
    const beatStronger = eloDelta(1000, 1200, 1, 30);
    const beatWeaker = eloDelta(1000, 800, 1, 30);
    expect(beatStronger).toBeGreaterThan(beatWeaker);
  });

  it("thua người yếu hơn mất nhiều điểm hơn thua người mạnh hơn", () => {
    expect(eloDelta(1200, 1000, 0, 30)).toBeLessThan(eloDelta(1000, 1200, 0, 30));
  });

  it("tổng delta hai bên luôn bằng 0 khi cùng số trận", () => {
    const cases: [number, number, 1 | 0.5 | 0][] = [
      [1000, 1000, 1],
      [1234, 987, 0],
      [1600, 1010, 0.5],
      [900, 1500, 1],
    ];
    for (const [a, b, r] of cases) {
      const other = (1 - r) as 1 | 0.5 | 0;
      expect(eloDelta(a, b, r, 30) + eloDelta(b, a, other, 30)).toBe(0);
    }
  });

  it("kỳ vọng thắng nằm trong khoảng 0-1 và đối xứng", () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
    expect(expectedScore(1400, 1000) + expectedScore(1000, 1400)).toBeCloseTo(1);
  });
});

describe("decideWinner", () => {
  const line = (id: string, score: number, correct: number, totalMs: number) => ({
    employeeId: id,
    score,
    correct,
    totalMs,
  });

  it("thắng theo điểm", () => {
    expect(decideWinner([line("a", 500, 4, 100), line("b", 400, 5, 50)])).toEqual({
      winnerId: "a",
      reason: "score",
    });
  });

  it("hoà điểm thì xét số câu đúng", () => {
    expect(decideWinner([line("a", 400, 4, 100), line("b", 400, 5, 900)])).toEqual({
      winnerId: "b",
      reason: "correct",
    });
  });

  it("hoà điểm và số câu đúng thì ai nhanh hơn thắng", () => {
    expect(decideWinner([line("a", 400, 4, 900), line("b", 400, 4, 100)])).toEqual({
      winnerId: "b",
      reason: "speed",
    });
  });

  it("hoàn toàn bằng nhau là hoà", () => {
    expect(decideWinner([line("a", 400, 4, 100), line("b", 400, 4, 100)])).toEqual({
      winnerId: null,
      reason: "draw",
    });
  });
});

describe("remainingMs", () => {
  it("chưa phát câu thì còn nguyên thời gian", () => {
    expect(remainingMs(null, 20, 0, Date.now())).toBe(20_000);
  });

  it("trừ theo giờ máy chủ đã bù độ lệch", () => {
    const served = new Date(1_000_000).toISOString();
    // Đồng hồ client chậm 5 giây so với máy chủ.
    expect(remainingMs(served, 20, 5_000, 1_005_000)).toBe(10_000);
  });

  it("không bao giờ âm hoặc vượt quá thời lượng câu", () => {
    const served = new Date(1_000_000).toISOString();
    expect(remainingMs(served, 20, 0, 9_999_999)).toBe(0);
    expect(remainingMs(served, 20, 0, 500_000)).toBe(20_000);
    expect(remainingMs("khong-hop-le", 20, 0, 500_000)).toBe(20_000);
  });
});

describe("eloTier", () => {
  it("phân hạng đúng mốc", () => {
    expect(eloTier(999).label).toBe("Đồng");
    expect(eloTier(1000).label).toBe("Bạc");
    expect(eloTier(1200).label).toBe("Vàng");
    expect(eloTier(1400).label).toBe("Bạch kim");
    expect(eloTier(1600).label).toBe("Kim cương");
  });
});
