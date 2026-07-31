import { describe, expect, it } from "vitest";

import { BOT_EMPLOYEE_IDS, BOT_TIERS, botDecision, isBotEmployee, tierOf } from "./bot";

describe("trợ lý luyện tập", () => {
  it("mỗi mức độ có nhiều hồ sơ để nhiều người luyện cùng lúc", () => {
    expect(BOT_TIERS).toHaveLength(3);
    expect(BOT_TIERS.every((t) => t.employeeIds.length >= 2)).toBe(true);
    expect(new Set(BOT_EMPLOYEE_IDS).size).toBe(BOT_EMPLOYEE_IDS.length);
  });

  it("nhận diện được hồ sơ trợ lý", () => {
    expect(isBotEmployee(BOT_EMPLOYEE_IDS[0])).toBe(true);
    expect(isBotEmployee("11111111-1111-4111-8111-111111111111")).toBe(false);
  });

  it("mức độ lạ thì rơi về mức vừa", () => {
    expect(tierOf("khong-co").id).toBe("vua");
    expect(tierOf("kho").id).toBe("kho");
  });

  it("thời gian bấm luôn nằm trong giới hạn của câu", () => {
    for (const tier of BOT_TIERS) {
      for (let i = 0; i < 200; i += 1) {
        const d = botDecision(tier, 20_000);
        expect(d.msTaken).toBeGreaterThanOrEqual(600);
        expect(d.msTaken).toBeLessThanOrEqual(19_800);
      }
    }
  });

  it("mức khó trả lời đúng nhiều hơn mức dễ", () => {
    const rate = (tier: (typeof BOT_TIERS)[number]) => {
      let hit = 0;
      for (let i = 0; i < 2000; i += 1) if (botDecision(tier, 20_000).isCorrect) hit += 1;
      return hit / 2000;
    };
    expect(rate(BOT_TIERS[2])).toBeGreaterThan(rate(BOT_TIERS[0]));
  });

  it("nguồn ngẫu nhiên cố định cho kết quả xác định", () => {
    const d = botDecision(BOT_TIERS[1], 20_000, () => 0);
    expect(d.isCorrect).toBe(true);
    expect(d.msTaken).toBe(6_000);
  });
});
