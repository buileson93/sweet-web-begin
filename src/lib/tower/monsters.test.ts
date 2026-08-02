import { describe, expect, it } from "vitest";

import {
  affinityOf,
  ELEMENTS,
  heroHit,
  MONSTERS,
  monsterHit,
  monsterMaxHp,
  monsterById,
  pickMonster,
  tierFor,
} from "@/lib/tower/monsters";
import { seededRandom } from "@/lib/tower/rng";

describe("sổ tay quái vật Leo Tháp", () => {
  it("mỗi quái có mã riêng và đủ ba hệ ở mọi bậc", () => {
    const ids = MONSTERS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tier of [1, 2, 3, 4]) {
      const inTier = MONSTERS.filter((m) => m.tier === tier);
      expect(new Set(inTier.map((m) => m.element)).size).toBe(3);
    }
  });

  it("vòng khắc hệ khép kín: mỗi lớp khắc đúng một hệ và bị đúng một hệ khắc", () => {
    const weak = Object.values(ELEMENTS).map((e) => e.weakTo);
    const strong = Object.values(ELEMENTS).map((e) => e.strongVs);
    expect(new Set(weak).size).toBe(3);
    expect(new Set(strong).size).toBe(3);
    for (const el of Object.values(ELEMENTS)) expect(el.weakTo).not.toBe(el.strongVs);
  });

  it("bậc quái tăng theo độ sâu và loại phòng", () => {
    expect(tierFor("combat", 1)).toBe(1);
    expect(tierFor("combat", 6)).toBe(2);
    expect(tierFor("combat", 10)).toBe(3);
    expect(tierFor("elite", 3)).toBe(3);
    expect(tierFor("boss", 4)).toBe(4);
  });

  it("quái mạnh hơn thì máu nhiều hơn và đánh đau hơn", () => {
    const weakest = MONSTERS.find((m) => m.tier === 1)!;
    const strongest = MONSTERS.find((m) => m.tier === 4)!;
    expect(monsterMaxHp(strongest, 1)).toBeGreaterThan(monsterMaxHp(weakest, 1));
    const soft = monsterHit("kiem_si", weakest, 10, 1).damage;
    const hard = monsterHit("kiem_si", strongest, 10, 1).damage;
    expect(hard).toBeGreaterThan(soft);
  });

  it("máu quái tăng dần theo tầng", () => {
    const def = MONSTERS[0]!;
    expect(monsterMaxHp(def, 10)).toBeGreaterThan(monsterMaxHp(def, 1));
  });

  it("khắc hệ làm đòn của người chơi mạnh hơn, bị khắc thì yếu đi", () => {
    const storm = MONSTERS.find((m) => m.element === "thoi_tiet")!;
    expect(affinityOf("ve_binh", "thoi_tiet")).toBe("khac_che");
    expect(affinityOf("phap_su", "thoi_tiet")).toBe("bi_khac");
    const good = heroHit("ve_binh", storm, 20).damage;
    const even = heroHit("kiem_si", storm, 20).damage;
    const bad = heroHit("phap_su", storm, 20).damage;
    expect(good / 0.95).toBeGreaterThan(even / 1.06);
    expect(bad / 1.18).toBeLessThan(even / 1.06);
  });

  it("bị khắc hệ thì nhận đòn nặng hơn", () => {
    const storm = MONSTERS.find((m) => m.element === "thoi_tiet")!;
    const mage = monsterHit("phap_su", storm, 10, 1).damage;
    const guard = monsterHit("ve_binh", storm, 10, 1).damage;
    expect(mage).toBeGreaterThan(guard);
  });

  it("cùng hạt thì bốc ra cùng một con quái", () => {
    const a = pickMonster(seededRandom("x"), "combat", 3);
    const b = pickMonster(seededRandom("x"), "combat", 3);
    expect(a).toEqual(b);
    expect(monsterById(a.id)).toBeDefined();
    expect(a.hp).toBe(a.maxHp);
  });
});
