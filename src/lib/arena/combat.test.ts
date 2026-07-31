import { describe, expect, it } from "vitest";

import {
  BASE_DAMAGE,
  HP_START,
  comboDamage,
  decideWinnerByHp,
  resolveRoundCombat,
  winReasonLabel,
} from "./combat";

const LIMIT = 20_000;

const line = (over: Partial<Parameters<typeof resolveRoundCombat>[0][number]> & { employeeId: string }) => ({
  answered: true,
  isCorrect: false,
  msTaken: 5_000,
  streak: 0,
  hpBefore: HP_START,
  ...over,
});

describe("comboDamage", () => {
  it("đúng câu đầu, trả lời chậm nhất chỉ gây sát thương gốc", () => {
    expect(comboDamage(1, LIMIT, LIMIT)).toBe(BASE_DAMAGE);
  });

  it("càng nhanh càng đau (tối đa +5)", () => {
    expect(comboDamage(1, 0, LIMIT)).toBe(BASE_DAMAGE + 5);
  });

  it("combo cộng 3 sát thương mỗi bậc", () => {
    expect(comboDamage(2, LIMIT, LIMIT)).toBe(13);
    expect(comboDamage(4, LIMIT, LIMIT)).toBe(19);
  });

  it("combo bị chặn trần ở 5 bậc", () => {
    expect(comboDamage(6, LIMIT, LIMIT)).toBe(25);
    expect(comboDamage(50, LIMIT, LIMIT)).toBe(25);
  });

  it("chuẩn hoá giá trị thời gian bất thường", () => {
    expect(comboDamage(1, -100, LIMIT)).toBe(BASE_DAMAGE + 5);
    expect(comboDamage(1, Number.NaN, LIMIT)).toBe(BASE_DAMAGE + 5);
  });
});

describe("resolveRoundCombat", () => {
  it("ai đúng trước thì gây sát thương, người kia mất máu", () => {
    const out = resolveRoundCombat(
      [
        line({ employeeId: "a", isCorrect: true, msTaken: 3_000, streak: 1 }),
        line({ employeeId: "b", isCorrect: true, msTaken: 9_000, streak: 1 }),
      ],
      LIMIT,
    );
    const a = out.lines.find((l) => l.employeeId === "a")!;
    const b = out.lines.find((l) => l.employeeId === "b")!;
    expect(a.firstCorrect).toBe(true);
    expect(a.damageDealt).toBeGreaterThan(0);
    expect(a.damageTaken).toBe(0);
    expect(b.damageTaken).toBe(a.damageDealt);
    expect(b.hpAfter).toBe(HP_START - a.damageDealt);
    expect(out.neutral).toBe(false);
  });

  it("cả hai cùng sai thì hoà câu, không ai mất máu", () => {
    const out = resolveRoundCombat(
      [line({ employeeId: "a" }), line({ employeeId: "b", answered: false })],
      LIMIT,
    );
    expect(out.neutral).toBe(true);
    expect(out.lines.every((l) => l.damageTaken === 0 && l.hpAfter === HP_START)).toBe(true);
  });

  it("cùng đúng và cùng mốc thời gian thì hoà câu", () => {
    const out = resolveRoundCombat(
      [
        line({ employeeId: "a", isCorrect: true, msTaken: 4_000, streak: 1 }),
        line({ employeeId: "b", isCorrect: true, msTaken: 4_000, streak: 1 }),
      ],
      LIMIT,
    );
    expect(out.neutral).toBe(true);
    expect(out.knockedOutId).toBeNull();
  });

  it("máu không âm và báo hạ gục", () => {
    const out = resolveRoundCombat(
      [
        line({ employeeId: "a", isCorrect: true, msTaken: 0, streak: 9 }),
        line({ employeeId: "b", hpBefore: 5 }),
      ],
      LIMIT,
    );
    expect(out.knockedOutId).toBe("b");
    expect(out.lines.find((l) => l.employeeId === "b")!.hpAfter).toBe(0);
  });
});

describe("decideWinnerByHp", () => {
  const base = { damageDealt: 0, correct: 0, totalMs: 0 };

  it("hạ gục thắng ngay", () => {
    expect(
      decideWinnerByHp([
        { employeeId: "a", hp: 0, ...base },
        { employeeId: "b", hp: 12, ...base },
      ]),
    ).toEqual({ winnerId: "b", reason: "ko" });
  });

  it("còn nhiều máu hơn thì thắng", () => {
    expect(
      decideWinnerByHp([
        { employeeId: "a", hp: 40, ...base },
        { employeeId: "b", hp: 70, ...base },
      ]).winnerId,
    ).toBe("b");
  });

  it("bằng máu thì xét sát thương, rồi câu đúng, rồi tốc độ", () => {
    expect(
      decideWinnerByHp([
        { employeeId: "a", hp: 50, ...base, damageDealt: 30 },
        { employeeId: "b", hp: 50, ...base, damageDealt: 20 },
      ]).reason,
    ).toBe("damage");
    expect(
      decideWinnerByHp([
        { employeeId: "a", hp: 50, ...base, correct: 3 },
        { employeeId: "b", hp: 50, ...base, correct: 5 },
      ]).winnerId,
    ).toBe("b");
    expect(
      decideWinnerByHp([
        { employeeId: "a", hp: 50, ...base, totalMs: 9_000 },
        { employeeId: "b", hp: 50, ...base, totalMs: 12_000 },
      ]).winnerId,
    ).toBe("a");
  });

  it("giống hệt nhau thì hoà", () => {
    expect(
      decideWinnerByHp([
        { employeeId: "a", hp: 50, ...base },
        { employeeId: "b", hp: 50, ...base },
      ]),
    ).toEqual({ winnerId: null, reason: "draw" });
  });

  it("có nhãn tiếng Việt cho mọi tiêu chí", () => {
    expect(winReasonLabel("ko")).toBe("Hạ gục");
    expect(winReasonLabel("draw")).toBe("Hoà");
  });
});
