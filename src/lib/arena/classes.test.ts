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
    expect(counterVerdict("cung_thu", "phap_su")).toBe("counter");
    expect(counterVerdict("phap_su", "cung_thu")).toBe("countered");
    expect(counterVerdict("chien_binh", "chien_binh")).toBe("even");
    expect(counterVerdict("phap_su", "chien_binh")).toBe("counter");
    expect(counterVerdict("chien_binh", "cung_thu")).toBe("counter");
  });

  it("cung thủ đánh đau hơn chiến binh trên cùng một đòn gốc", () => {
    const kiem = applyClassDamage("cung_thu", "phap_su", 10).damage;
    const ve = applyClassDamage("chien_binh", "phap_su", 10).damage;
    expect(kiem).toBeGreaterThan(ve);
  });

  it("chiến binh chịu đòn nhẹ hơn khi cùng một người đánh", () => {
    const vaoVeBinh = applyClassDamage("cung_thu", "chien_binh", 20).damage;
    const vaoPhapSu = applyClassDamage("cung_thu", "phap_su", 20).damage;
    expect(vaoVeBinh).toBeLessThan(vaoPhapSu);
    expect(classById("chien_binh").defenseMul).toBeLessThan(classById("cung_thu").defenseMul);
  });

  it("khắc chế cộng thêm sát thương so với đối đầu cùng lớp", () => {
    const counter = applyClassDamage("chien_binh", "cung_thu", 20);
    const even = applyClassDamage("chien_binh", "chien_binh", 20);
    expect(counter.verdict).toBe("counter");
    expect(counter.damage).toBeGreaterThan(even.damage);
    expect(counter.label).toContain("khắc chế");
  });

  it("bị khắc chế thì sát thương giảm và có diễn giải", () => {
    const e = applyClassDamage("phap_su", "cung_thu", 20);
    expect(e.verdict).toBe("countered");
    expect(e.label).toContain("hoá giải");
  });

  it("đòn 0 sát thương giữ nguyên 0, đòn có sát thương luôn tối thiểu 1", () => {
    expect(applyClassDamage("cung_thu", "chien_binh", 0).damage).toBe(0);
    expect(applyClassDamage("chien_binh", "phap_su", 1).damage).toBeGreaterThanOrEqual(1);
  });

  it("sát thương luôn là số nguyên", () => {
    for (const a of CLASSES)
      for (const d of CLASSES)
        for (const base of [3, 7, 11, 17])
          expect(Number.isInteger(applyClassDamage(a.id, d.id, base).damage)).toBe(true);
  });
});
