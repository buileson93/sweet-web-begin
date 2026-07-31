import { describe, expect, it } from "vitest";

import {
  SKILLS,
  SKILL_COOLDOWN_ROUNDS,
  applyAttackSkill,
  applyDefenseSkill,
  skillById,
  skillCooldownLeft,
  skillReady,
} from "./skills";

describe("danh sách kỹ năng", () => {
  it("có đúng 3 kỹ năng, mã không trùng", () => {
    expect(SKILLS).toHaveLength(3);
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(3);
  });

  it("tra cứu được theo mã", () => {
    expect(skillById("chi_mang")?.name).toBe("Chí mạng");
    expect(skillById("khong_co")).toBeNull();
    expect(skillById(null)).toBeNull();
  });
});

describe("cooldown", () => {
  it("chưa dùng thì sẵn sàng", () => {
    expect(skillCooldownLeft([], 0)).toBe(0);
    expect(skillReady([], 3)).toBe(true);
  });

  it("dùng xong phải chờ đủ 5 lượt", () => {
    expect(skillCooldownLeft([2], 2)).toBe(SKILL_COOLDOWN_ROUNDS);
    expect(skillCooldownLeft([2], 4)).toBe(3);
    expect(skillReady([2], 6)).toBe(false);
    expect(skillReady([2], 7)).toBe(true);
  });

  it("tính theo lần dùng gần nhất", () => {
    expect(skillCooldownLeft([0, 5], 6)).toBe(4);
  });
});

describe("kỹ năng tấn công", () => {
  it("Công phá cộng 3–8 sát thương", () => {
    expect(applyAttackSkill("cong_pha", 10, () => 0).damage).toBe(13);
    expect(applyAttackSkill("cong_pha", 10, () => 0.999).damage).toBe(18);
  });

  it("Chí mạng nhân đôi khi trúng, +2 khi hụt", () => {
    expect(applyAttackSkill("chi_mang", 10, () => 0).damage).toBe(20);
    expect(applyAttackSkill("chi_mang", 10, () => 0.9).damage).toBe(12);
  });

  it("không có kỹ năng hoặc không gây sát thương thì giữ nguyên", () => {
    expect(applyAttackSkill(null, 10).damage).toBe(10);
    expect(applyAttackSkill("cong_pha", 0, () => 0.5)).toEqual({ damage: 0, label: "" });
  });
});

describe("kỹ năng phòng thủ", () => {
  it("Khiên thép chặn 30–70%", () => {
    expect(applyDefenseSkill("khien_thep", 10, () => 0).damage).toBe(7);
    expect(applyDefenseSkill("khien_thep", 10, () => 0.999).damage).toBe(3);
  });

  it("kỹ năng tấn công không dùng để đỡ đòn", () => {
    expect(applyDefenseSkill("cong_pha", 10, () => 0).damage).toBe(10);
  });
});
