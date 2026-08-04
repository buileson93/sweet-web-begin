import { describe, expect, it } from "vitest";

import { buildCloak, randomToken, shuffled } from "./optionCloak";

/** RNG tất định để test ổn định. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe("optionCloak", () => {
  it("sinh token dùng một lần, khác nhau giữa các lần tải", () => {
    const a = buildCloak(["A", "B", "C", "D"], { rng: seeded(1) });
    const b = buildCloak(["A", "B", "C", "D"], { rng: seeded(2) });
    expect(a.tokenOf(0)).toMatch(/^tok_[a-z0-9]{8}$/);
    expect(a.tokenOf(0)).not.toBe(b.tokenOf(0));
  });

  it("token của các phương án trong cùng một lần tải là duy nhất", () => {
    const c = buildCloak(["A", "B", "C", "D"], { rng: seeded(7) });
    const tokens = c.slots.map((s) => s.token);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("giữ đủ phương án thật và gắn đúng chỉ số hiển thị", () => {
    const c = buildCloak(["A", "B", "C", "D"], { rng: seeded(3) });
    const real = c.slots.filter((s) => s.kind === "real");
    expect(real).toHaveLength(4);
    expect(real.map((s) => s.index).sort()).toEqual([0, 1, 2, 3]);
    for (const s of real) expect(s.visual).toBe(s.index);
    for (const s of real) expect(s.text).toBe(["A", "B", "C", "D"][s.index]);
  });

  it("chèn thẻ mồi và có thể tráo thứ tự DOM", () => {
    const c = buildCloak(["A", "B", "C", "D"], { rng: seeded(11), trapCount: 2 });
    expect(c.slots.filter((s) => s.kind === "trap")).toHaveLength(2);
    const domOrder = c.slots.filter((s) => s.kind === "real").map((s) => s.index);
    expect(domOrder).not.toEqual([0, 1, 2, 3]);
  });

  it("không chèn mồi khi không có phương án nào", () => {
    expect(buildCloak([], { rng: seeded(5) }).slots).toHaveLength(0);
  });

  it("shuffled giữ nguyên tập phần tử", () => {
    const out = shuffled([1, 2, 3, 4, 5], seeded(9));
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("randomToken luôn đúng định dạng", () => {
    expect(randomToken(seeded(42))).toMatch(/^tok_[a-z0-9]{8}$/);
  });
});
