import { describe, expect, it } from "vitest";

import { hashSeed, seededRng, seededRollDurations } from "./seed";

describe("seed", () => {
  it("băm ổn định cho cùng chuỗi", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).not.toBe(hashSeed("abd"));
  });

  it("cùng seed cho cùng dãy số", () => {
    const a = seededRng(123);
    const b = seededRng(123);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("thời gian lăn giống nhau ở hai máy và nằm trong ngân sách", () => {
    const x = seededRollDurations("duel-1:3", 2, 1600);
    const y = seededRollDurations("duel-1:3", 2, 1600);
    expect(x).toEqual(y);
    for (const ms of x) {
      expect(ms).toBeGreaterThan(300);
      expect(ms).toBeLessThanOrEqual(1450);
    }
  });

  it("lượt khác nhau cho nhịp lăn khác nhau", () => {
    expect(seededRollDurations("duel-1:3", 2)).not.toEqual(seededRollDurations("duel-1:4", 2));
  });
});
