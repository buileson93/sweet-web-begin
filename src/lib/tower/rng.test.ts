import { describe, expect, it } from "vitest";

import { offerBoons } from "./config";
import { seededRandom, towerDamage } from "./rng";

describe("seededRandom", () => {
  it("cùng hạt cho cùng chuỗi số", () => {
    const a = seededRandom("leo-thap");
    const b = seededRandom("leo-thap");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("khác hạt cho chuỗi khác", () => {
    expect(seededRandom("a")()).not.toBe(seededRandom("b")());
  });

  it("luôn nằm trong [0,1)", () => {
    const r = seededRandom(7);
    for (let i = 0; i < 200; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("towerDamage — khoá cứng thứ tự", () => {
  it("xúc xắc → combo → trợ học", () => {
    expect(towerDamage({ roll: 5, combo: 1, damageBonus: 0 })).toBe(5);
    expect(towerDamage({ roll: 5, combo: 3, damageBonus: 0 })).toBe(9);
    expect(towerDamage({ roll: 5, combo: 3, damageBonus: 2 })).toBe(11);
  });

  it("combo có trần và sát thương có trần", () => {
    expect(towerDamage({ roll: 5, combo: 20, damageBonus: 0 })).toBe(11);
    expect(towerDamage({ roll: 30, combo: 20, damageBonus: 20 })).toBe(40);
  });

  it("tối thiểu 1 sát thương", () => {
    expect(towerDamage({ roll: 0, combo: 1, damageBonus: 0 })).toBe(1);
  });
});

describe("offerBoons", () => {
  it("luôn đưa 3 lựa chọn khác nhau và tái lập theo hạt", () => {
    const a = offerBoons(seededRandom("x"));
    const b = offerBoons(seededRandom("x"));
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(new Set(a.map((x) => x.id)).size).toBe(3);
  });

  it("không đề xuất lại trợ học đã lấy", () => {
    const taken = ["so-tay", "ca-phe", "but-do"];
    const out = offerBoons(seededRandom("y"), taken);
    expect(out.some((b) => taken.includes(b.id))).toBe(false);
  });
});
