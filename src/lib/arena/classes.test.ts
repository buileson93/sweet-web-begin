import { describe, expect, it } from "vitest";

import {
  applyClassDamage,
  classById,
  counterVerdict,
  CLASSES,
  DEFAULT_CLASS,
} from "./classes";

describe("lớp chiến binh", () => {
  it("có đủ 3 lớp và tạo thành vòng khắc chế khép kín", () => {
    expect(CLASSES).toHaveLength(3);
    const ids = CLASSES.map((c) => c.id).sort();
    const beats = CLASSES.map((c) => c.beats).sort();
    expect(beats).toEqual(ids);
    for (const c of CLASSES) expect(c.beats).not.toBe(c.id);
  });

  it("mã lạ hoặc rỗng thì trả về lớp mặc định", () => {
    expect(classById("khong_co").id).toBe(DEFAULT_CLASS);
    expect(classById(null).id).toBe(DEFAULT_CLASS);
  });

  it("xét khắc chế đúng chiều bao–búa–kéo", () => {
    expect(counterVerdict("kiem_si", "phap_su")).toBe("counter");
    expect(counterVerdict("phap_su", "kiem_si")).toBe("countered");
    expect(counterVerdict("ve_binh", "ve_binh")).toBe("even");
    expect(counterVerdict("phap_su", "ve_binh")).toBe("counter");
    expect(counterVerdict("ve_binh", "kiem_si")).toBe("counter");
  });

  it("cung thủ đánh đau hơn chiến binh trên cùng một đòn gốc", () => {
    const kiem = applyClassDamage("kiem_si", "phap_su", 10).damage;
    const ve = applyClassDamage("ve_binh", "phap_su", 10).damage;
    expect(kiem).toBeGreaterThan(ve);
  });

  it("chiến binh chịu đòn nhẹ hơn khi cùng một người đánh", () => {
    const vaoVeBinh = applyClassDamage("kiem_si", "ve_binh", 20).damage;
    const vaoPhapSu = applyClassDamage("kiem_si", "phap_su", 20).damage;
    expect(vaoVeBinh).toBeLessThan(vaoPhapSu);
    expect(classById("ve_binh").defenseMul).toBeLessThan(classById("kiem_si").defenseMul);
  });

  it("khắc chế cộng thêm sát thương so với đối đầu cùng lớp", () => {
    const counter = applyClassDamage("ve_binh", "kiem_si", 20);
    const even = applyClassDamage("ve_binh", "ve_binh", 20);
    expect(counter.verdict).toBe("counter");
    expect(counter.damage).toBeGreaterThan(even.damage);
    expect(counter.label).toContain("khắc chế");
  });

  it("bị khắc chế thì sát thương giảm và có diễn giải", () => {
    const e = applyClassDamage("phap_su", "kiem_si", 20);
    expect(e.verdict).toBe("countered");
    expect(e.label).toContain("hoá giải");
  });

  it("đòn 0 sát thương giữ nguyên 0, đòn có sát thương luôn tối thiểu 1", () => {
    expect(applyClassDamage("kiem_si", "ve_binh", 0).damage).toBe(0);
    expect(applyClassDamage("ve_binh", "phap_su", 1).damage).toBeGreaterThanOrEqual(1);
  });

  it("sát thương luôn là số nguyên", () => {
    for (const a of CLASSES)
      for (const d of CLASSES)
        for (const base of [3, 7, 11, 17])
          expect(Number.isInteger(applyClassDamage(a.id, d.id, base).damage)).toBe(true);
  });
});

describe("tính chất 3 lớp chính thức", () => {
  it("Pháp sư đánh mạnh nhất nhưng chịu đòn kém nhất", () => {
    const attacks = CLASSES.map((c) => c.attackMul);
    const defenses = CLASSES.map((c) => c.defenseMul);
    expect(classById("phap_su").attackMul).toBe(Math.max(...attacks));
    expect(classById("phap_su").defenseMul).toBe(Math.max(...defenses));
  });

  it("Vệ binh thủ tốt nhất nhưng ra đòn nhẹ nhất", () => {
    const attacks = CLASSES.map((c) => c.attackMul);
    const defenses = CLASSES.map((c) => c.defenseMul);
    expect(classById("ve_binh").defenseMul).toBe(Math.min(...defenses));
    expect(classById("ve_binh").attackMul).toBe(Math.min(...attacks));
  });

  it("Kiếm sĩ nằm giữa ở cả công lẫn thủ", () => {
    const k = classById("kiem_si");
    expect(k.attackMul).toBeGreaterThan(classById("ve_binh").attackMul);
    expect(k.attackMul).toBeLessThan(classById("phap_su").attackMul);
    expect(k.defenseMul).toBeGreaterThan(classById("ve_binh").defenseMul);
    expect(k.defenseMul).toBeLessThan(classById("phap_su").defenseMul);
  });

  it("vòng khắc chế: Kiếm sĩ ▸ Pháp sư ▸ Vệ binh ▸ Kiếm sĩ", () => {
    expect(counterVerdict("kiem_si", "phap_su")).toBe("counter");
    expect(counterVerdict("phap_su", "ve_binh")).toBe("counter");
    expect(counterVerdict("ve_binh", "kiem_si")).toBe("counter");
  });
});
