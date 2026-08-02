import { describe, expect, it } from "vitest";

import {
  DICE_COUNT,
  DICE_SIDES,
  HP_START,
  comboDamage,
  decideWinnerByHp,
  resolveRoundCombat,
  rollDice,
  TIMEOUT_HP_LOSS,
  winReasonLabel,
} from "./combat";

const LIMIT = 20_000;
/** Xúc xắc "gian lận" để kiểm thử: luôn ra mặt 6 (tổng 12). */
const maxRng = () => 0.999;
/** Xúc xắc luôn ra mặt 1 (tổng 2). */
const minRng = () => 0;

const line = (over: Partial<Parameters<typeof resolveRoundCombat>[0][number]> & { employeeId: string }) => ({
  answered: true,
  isCorrect: false,
  msTaken: 5_000,
  streak: 0,
  hpBefore: HP_START,
  ...over,
});

describe("rollDice", () => {
  it("tung đúng hai viên, mỗi viên 1–6", () => {
    for (let i = 0; i < 200; i += 1) {
      const { dice, total } = rollDice();
      expect(dice).toHaveLength(DICE_COUNT);
      expect(dice.every((d) => Number.isInteger(d) && d >= 1 && d <= DICE_SIDES)).toBe(true);
      expect(total).toBe(dice[0] + dice[1]);
      expect(total).toBeGreaterThanOrEqual(2);
      expect(total).toBeLessThanOrEqual(12);
    }
  });

  it("hai đầu mút của nguồn ngẫu nhiên cho 2 và 12", () => {
    expect(rollDice(minRng).total).toBe(2);
    expect(rollDice(maxRng).total).toBe(12);
  });
});

describe("comboDamage", () => {
  it("đúng câu đầu, trả lời chậm nhất chỉ gây đúng số xúc xắc", () => {
    expect(comboDamage(1, LIMIT, LIMIT, 7)).toBe(7);
  });

  it("càng nhanh càng đau (tối đa +5)", () => {
    expect(comboDamage(1, 0, LIMIT, 7)).toBe(12);
  });

  it("combo cộng 3 sát thương mỗi bậc", () => {
    expect(comboDamage(2, LIMIT, LIMIT, 10)).toBe(13);
    expect(comboDamage(4, LIMIT, LIMIT, 10)).toBe(19);
  });

  it("combo bị chặn trần ở 5 bậc", () => {
    expect(comboDamage(6, LIMIT, LIMIT, 10)).toBe(25);
    expect(comboDamage(50, LIMIT, LIMIT, 10)).toBe(25);
  });

  it("chuẩn hoá giá trị thời gian và xúc xắc bất thường", () => {
    expect(comboDamage(1, -100, LIMIT, 7)).toBe(12);
    expect(comboDamage(1, Number.NaN, LIMIT, 7)).toBe(12);
    expect(comboDamage(1, LIMIT, LIMIT, 999)).toBe(12);
    expect(comboDamage(1, LIMIT, LIMIT, -5)).toBe(2);
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
      maxRng,
    );
    const a = out.lines.find((l) => l.employeeId === "a")!;
    const b = out.lines.find((l) => l.employeeId === "b")!;
    expect(a.firstCorrect).toBe(true);
    expect(a.damageDealt).toBeGreaterThan(0);
    expect(a.damageTaken).toBe(0);
    expect(b.damageTaken).toBe(a.damageDealt);
    expect(b.hpAfter).toBe(HP_START - a.damageDealt);
    expect(out.neutral).toBe(false);
    expect(out.dice).toEqual([6, 6]);
  });

  it("sát thương luôn nằm trong khoảng xúc xắc cho phép", () => {
    for (let i = 0; i < 100; i += 1) {
      const out = resolveRoundCombat(
        [
          line({ employeeId: "a", isCorrect: true, msTaken: LIMIT, streak: 1 }),
          line({ employeeId: "b" }),
        ],
        LIMIT,
      );
      const a = out.lines.find((l) => l.employeeId === "a")!;
      expect(a.damageDealt).toBeGreaterThanOrEqual(2);
      expect(a.damageDealt).toBeLessThanOrEqual(12);
    }
  });

  it("cả hai cùng sai thì hoà câu, không ai mất máu", () => {
    const out = resolveRoundCombat(
      [line({ employeeId: "a" }), line({ employeeId: "b", answered: false })],
      LIMIT,
    );
    expect(out.neutral).toBe(true);
    expect(out.dice).toEqual([]);
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
      minRng,
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

describe("bỏ trống hết giờ", () => {
  it("cả hai cùng không trả lời thì mỗi người mất 10 máu", () => {
    const out = resolveRoundCombat(
      [
        { employeeId: "a", answered: false, isCorrect: false, msTaken: 15_000, streak: 0, hpBefore: 100 },
        { employeeId: "b", answered: false, isCorrect: false, msTaken: 15_000, streak: 0, hpBefore: 25 },
      ],
      15_000,
    );
    expect(out.timedOut).toBe(true);
    expect(out.neutral).toBe(false);
    expect(out.lines.map((l) => l.damageTaken)).toEqual([TIMEOUT_HP_LOSS, TIMEOUT_HP_LOSS]);
    expect(out.lines.map((l) => l.hpAfter)).toEqual([90, 15]);
  });

  it("bỏ trống làm máu về 0 thì tính hạ gục", () => {
    const out = resolveRoundCombat(
      [
        { employeeId: "a", answered: false, isCorrect: false, msTaken: 15_000, streak: 0, hpBefore: 8 },
        { employeeId: "b", answered: false, isCorrect: false, msTaken: 15_000, streak: 0, hpBefore: 60 },
      ],
      15_000,
    );
    expect(out.knockedOutId).toBe("a");
  });

  it("một người có trả lời thì không ai bị phạt bỏ trống", () => {
    const out = resolveRoundCombat(
      [
        { employeeId: "a", answered: true, isCorrect: false, msTaken: 5_000, streak: 0, hpBefore: 100 },
        { employeeId: "b", answered: false, isCorrect: false, msTaken: 15_000, streak: 0, hpBefore: 100 },
      ],
      15_000,
    );
    expect(out.timedOut).toBe(false);
    expect(out.lines.every((l) => l.damageTaken === 0)).toBe(true);
  });
});
