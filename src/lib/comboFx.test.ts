import { describe, expect, it } from "vitest";

import { COMBO_MAX_LEVEL, COMBO_MIN, comboTier, particleLayout } from "@/lib/comboFx";

describe("comboTier", () => {
  it("chưa đủ combo thì không có hiệu ứng", () => {
    expect(comboTier(0)).toBeNull();
    expect(comboTier(1)).toBeNull();
    expect(comboTier(COMBO_MIN - 1)).toBeNull();
  });

  it("bắt đầu từ cấp 1 khi đủ combo tối thiểu", () => {
    expect(comboTier(COMBO_MIN)?.level).toBe(1);
  });

  it("mạnh dần theo combo: biên độ rung và số hạt tăng", () => {
    const a = comboTier(2)!;
    const b = comboTier(5)!;
    expect(b.amplitude).toBeGreaterThan(a.amplitude);
    expect(b.particles).toBeGreaterThan(a.particles);
    expect(b.duration).toBeGreaterThan(a.duration);
  });

  it("không hiệu ứng nào trùng hiệu ứng nào", () => {
    const tiers = Array.from({ length: COMBO_MAX_LEVEL }, (_, i) => comboTier(COMBO_MIN + i)!);
    const uniq = (list: string[]) => new Set(list).size === list.length;
    expect(uniq(tiers.map((t) => t.label))).toBe(true);
    expect(uniq(tiers.map((t) => t.shake))).toBe(true);
    expect(uniq(tiers.map((t) => t.burst))).toBe(true);
    expect(uniq(tiers.map((t) => t.icon))).toBe(true);
    expect(uniq(tiers.map((t) => t.color))).toBe(true);
  });

  it("kịch trần ở cấp cao nhất", () => {
    expect(comboTier(999)?.level).toBe(COMBO_MAX_LEVEL);
  });
});

describe("particleLayout", () => {
  it("tạo đúng số hạt và không hạt nào đứng yên", () => {
    const tier = comboTier(6)!;
    const parts = particleLayout(tier);
    expect(parts).toHaveLength(tier.particles);
    expect(parts.every((p) => p.dx !== 0 || p.dy !== 0)).toBe(true);
  });
});
