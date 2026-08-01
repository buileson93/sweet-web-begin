import { describe, expect, it } from "vitest";

import type { BankQuestion, QuestionBank } from "@/lib/tower/bank";
import { simulateRuns } from "@/lib/tower/balance";
import { FLOORS } from "@/lib/tower/map";
import { scoreBreakdown, runScore } from "@/lib/tower/score";

const q = (i: number): BankQuestion => ({
  id: `q${i}`,
  quizId: "quiz-1",
  quizTitle: "Bộ đề mô phỏng",
  kind: "single",
  question: `Câu ${i}`,
  options: ["A", "B", "C", "D"],
  optionImages: [],
  imageUrl: null,
  imageAlt: "",
  explanation: "",
  tags: ["radar"],
  difficulty: i % 3 === 0 ? "hard" : "easy",
  answerIndex: i % 4,
  answerIndices: [],
  accepted: [],
  pairs: [],
  correctOrder: [],
});

const bank: QuestionBank = {
  version: 1,
  builtAt: new Date(0).toISOString(),
  questions: Array.from({ length: 120 }, (_, i) => q(i)),
};

describe("mô phỏng cân bằng Leo Tháp", () => {
  it("tái lập được: cùng hạt cho cùng kết quả", () => {
    const a = simulateRuns(bank, { runs: 10, accuracy: 0.75, seedPrefix: "kt" });
    const b = simulateRuns(bank, { runs: 10, accuracy: 0.75, seedPrefix: "kt" });
    expect(a).toEqual(b);
  });

  it("người chơi giỏi vượt được nhiều tầng hơn người chơi yếu", () => {
    const weak = simulateRuns(bank, { runs: 25, accuracy: 0.45, seedPrefix: "yeu" });
    const strong = simulateRuns(bank, { runs: 25, accuracy: 0.95, seedPrefix: "gioi" });
    expect(strong.avgFloors).toBeGreaterThan(weak.avgFloors);
    expect(strong.winRate).toBeGreaterThanOrEqual(weak.winRate);
  });

  it("độ khó nằm trong dải hợp lý ở mức chơi khá", () => {
    const r = simulateRuns(bank, { runs: 40, accuracy: 0.8, seedPrefix: "kha" });
    expect(r.avgFloors).toBeGreaterThan(1);
    expect(r.survivalByFloor).toHaveLength(FLOORS);
    expect(r.survivalByFloor[0]).toBeGreaterThanOrEqual(r.survivalByFloor[FLOORS - 1]!);
    expect(r.winRate).toBeLessThanOrEqual(100);
  });

  it("thăng thiên cao thì khó hơn", () => {
    const a0 = simulateRuns(bank, { runs: 25, accuracy: 0.8, ascension: 0, seedPrefix: "asc" });
    const a10 = simulateRuns(bank, { runs: 25, accuracy: 0.8, ascension: 10, seedPrefix: "asc" });
    expect(a10.avgHp).toBeLessThanOrEqual(a0.avgHp);
  });
});

describe("bóc tách nguồn gốc điểm", () => {
  it("tổng các phần luôn bằng điểm chính thức", () => {
    for (const asc of [0, 3, 7, 10]) {
      const input = { floorsCleared: 7, hp: 43, relics: ["a", "b", "c"], curses: ["mu-suong"], ascension: asc };
      const { parts, total } = scoreBreakdown(input);
      expect(total).toBe(runScore(input));
      expect(parts.reduce((s, p) => s + p.value, 0)).toBe(total);
    }
  });

  it("không có phần âm khi hành trình trắng tay", () => {
    const { parts, total } = scoreBreakdown({ floorsCleared: 0, hp: 0, relics: [], curses: [] });
    expect(total).toBe(0);
    expect(parts.every((p) => p.value >= 0)).toBe(true);
  });
});
