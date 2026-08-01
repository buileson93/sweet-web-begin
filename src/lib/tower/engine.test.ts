import { describe, expect, it } from "vitest";

import type { BankQuestion, QuestionBank } from "@/lib/tower/bank";
import { BOONS, QUESTIONS_PER_STAGE, START_HP } from "@/lib/tower/config";
import { createRun, gradeStage, presentQuestion, pickRunQuestions, stageSeconds, takeBoon, type TowerRun } from "@/lib/tower/engine";
import { gradeLocal } from "@/lib/tower/grade.local";
import { seededRandom } from "@/lib/tower/rng";
import { applyResults, dueCardIds, emptyState, mergeStates, normalizeState, pruneState } from "@/lib/tower/state";

const base = (over: Partial<BankQuestion> = {}): BankQuestion => ({
  id: "q1",
  kind: "single",
  question: "Câu hỏi",
  options: ["A", "B", "C", "D"],
  optionImages: [],
  imageUrl: null,
  imageAlt: "",
  explanation: "",
  tags: ["radar"],
  difficulty: "easy",
  answerIndex: 0,
  answerIndices: [],
  accepted: [],
  pairs: [],
  correctOrder: [],
  ...over,
});

describe("chấm tại máy người dùng", () => {
  it("chấm đúng câu một đáp án", () => {
    const q = base();
    expect(gradeLocal(q, 0)).toBe(1);
    expect(gradeLocal(q, 2)).toBe(0);
    expect(gradeLocal(q, undefined)).toBe(0);
  });

  it("chấm từng phần câu nhiều đáp án", () => {
    const q = base({ kind: "multi", answerIndices: [0, 2] });
    expect(gradeLocal(q, [0, 2])).toBe(1);
    expect(gradeLocal(q, [0])).toBe(0.5);
    expect(gradeLocal(q, [0, 1])).toBe(0);
  });

  it("bỏ dấu và cho sai 1 ký tự với câu điền dài", () => {
    const q = base({ kind: "fill_blank", accepted: ["đường băng"] });
    expect(gradeLocal(q, "DUONG BANG")).toBe(1);
    expect(gradeLocal(q, "sân đỗ")).toBe(0);
    const long = base({ kind: "fill_blank", accepted: ["kiểm soát không lưu"] });
    expect(gradeLocal(long, "kiem soat khong lu")).toBe(1);
  });

  it("chấm nối cặp theo vị trí hiển thị đã xáo", () => {
    const q = base({
      kind: "matching",
      pairs: [
        { left: "L1", right: "R1" },
        { left: "L2", right: "R2" },
      ],
      answerIndices: [1, 0],
    });
    expect(gradeLocal(q, { "0": 1, "1": 0 })).toBe(1);
    expect(gradeLocal(q, { "0": 0, "1": 1 })).toBe(0);
  });

  it("chấm sắp xếp thứ tự", () => {
    const q = base({ kind: "ordering", correctOrder: [2, 0, 1, 3] });
    expect(gradeLocal(q, [2, 0, 1, 3])).toBe(1);
    expect(gradeLocal(q, [0, 1, 2, 3])).toBe(0);
  });

  it("chấm đúng/sai", () => {
    const q = base({ kind: "true_false", options: ["Đúng", "Sai"], answerIndex: 1 });
    expect(gradeLocal(q, 1)).toBe(1);
    expect(gradeLocal(q, 0)).toBe(0);
  });
});

describe("xáo phương án giữ nguyên đáp án", () => {
  it("viết lại chỉ số đáp án theo không gian hiển thị", () => {
    for (let s = 0; s < 20; s++) {
      const q = base({ kind: "multi", answerIndices: [0, 3] });
      const shown = presentQuestion(q, seededRandom(`s${s}`));
      const chosen = shown.answerIndices.map((i) => shown.options[i]);
      expect(new Set(chosen)).toEqual(new Set(["A", "D"]));
      expect(gradeLocal(shown, shown.answerIndices)).toBe(1);
    }
  });

  it("xáo vế phải câu nối cặp mà vẫn chấm đúng", () => {
    const q = base({
      kind: "matching",
      pairs: [
        { left: "L1", right: "R1" },
        { left: "L2", right: "R2" },
        { left: "L3", right: "R3" },
      ],
    });
    const shown = presentQuestion(q, seededRandom("m"));
    const answer = Object.fromEntries(shown.answerIndices.map((v, i) => [String(i), v]));
    expect(gradeLocal(shown, answer)).toBe(1);
    shown.answerIndices.forEach((display, left) => {
      expect(shown.options[display]).toBe(q.pairs[left]!.right);
    });
  });
});

describe("lịch ôn tập trong một ô JSON", () => {
  it("đúng thì lên hộp, sai thì về hộp 1", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    let state = emptyState();
    state = applyResults(state, [{ questionId: "q1", correct: true, tags: ["radar"] }], now);
    expect(state.cards["q1"]![0]).toBe(2);
    expect(state.cards["q1"]![1]).toBe("2026-01-04");
    state = applyResults(state, [{ questionId: "q1", correct: false, tags: ["radar"] }], now);
    expect(state.cards["q1"]![0]).toBe(1);
    expect(state.topics["radar"]![1]).toBe(2);
  });

  it("liệt kê thẻ đến hạn theo ngày", () => {
    const state = normalizeState({ cards: { a: [1, "2026-01-01"], b: [3, "2030-01-01"] } });
    expect(dueCardIds(state, new Date("2026-01-02T00:00:00Z"))).toEqual(["a"]);
  });

  it("hợp nhất hai thiết bị theo hộp cao hơn", () => {
    const a = normalizeState({ cards: { q: [4, "2026-05-01"] } });
    const b = normalizeState({ cards: { q: [2, "2026-02-01"], z: [1, "2026-01-01"] } });
    const merged = mergeStates(a, b);
    expect(merged.cards["q"]![0]).toBe(4);
    expect(merged.cards["z"]).toBeDefined();
  });

  it("cắt bớt thẻ đã thuộc khi vượt ngưỡng dung lượng", () => {
    let state = emptyState();
    for (let i = 0; i < 200; i++) state.cards[`q${i}`] = [i % 2 === 0 ? 5 : 1, "2026-01-01"];
    state = pruneState(state, 2000);
    expect(JSON.stringify(state).length).toBeLessThanOrEqual(4000);
    expect(Object.values(state.cards).some(([box]) => box === 1)).toBe(true);
  });
});

describe("vòng chơi tại máy người dùng", () => {
  const bank: QuestionBank = {
    version: 1,
    builtAt: new Date().toISOString(),
    questions: Array.from({ length: 40 }, (_, i) => base({ id: `q${i}` })),
  };

  it("ưu tiên thẻ đến hạn trước thẻ mới", () => {
    const state = normalizeState({ cards: { q30: [1, "2020-01-01"] } });
    const picked = pickRunQuestions(bank, state, seededRandom("x"), new Date("2026-01-01"), 5);
    expect(picked.map((q) => q.id)).toContain("q30");
  });

  it("chấm chặng: đúng hết thì không mất máu", () => {
    const run = createRun(bank, emptyState(), "seed-1");
    const answers = Object.fromEntries(
      run.questions.slice(0, QUESTIONS_PER_STAGE).map((q, i) => [String(i), q.answerIndex]),
    );
    const { run: next, outcome } = gradeStage(run, answers);
    expect(next.hp).toBe(START_HP);
    expect(outcome.results.every((r) => r.correct)).toBe(true);
    expect(outcome.damage).toBeGreaterThan(0);
    expect(next.combo).toBe(QUESTIONS_PER_STAGE);
  });

  it("sai quá tỉ lệ cho phép thì dừng nhẹ nhàng", () => {
    const run = createRun(bank, emptyState(), "seed-2");
    const { run: next, outcome } = gradeStage(run, {});
    expect(outcome.softStop).toBe(true);
    expect(next.finished).toBe(true);
    expect(next.hp).toBeLessThan(START_HP);
  });

  it("cùng hạt ngẫu nhiên cho cùng một phiên", () => {
    const a = createRun(bank, emptyState(), "same");
    const b = createRun(bank, emptyState(), "same");
    expect(a.questions.map((q) => q.id)).toEqual(b.questions.map((q) => q.id));
    expect(a.offered.map((o) => o.id)).toEqual(b.offered.map((o) => o.id));
  });
});

const baseRun = (): TowerRun => ({
  seed: "seed",
  questions: [],
  stage: 1,
  hp: START_HP,
  shield: 0,
  combo: 0,
  correct: 0,
  answered: 0,
  boons: [],
  offered: [],
  finished: false,
  startedAt: Date.now(),
});

describe("trợ giúp (boon) có tác dụng thật", () => {
  it("nhận trợ giúp hồi máu thì tăng máu ngay và không vượt trần", () => {
    const heal = BOONS.find((b) => (b.effect.heal ?? 0) > 0);
    if (!heal) return;
    const run = { ...baseRun(), hp: 40, boons: [] as string[] };
    const after = takeBoon(run, heal.id);
    expect(after.hp).toBe(Math.min(START_HP, 40 + (heal.effect.heal ?? 0)));
    expect(takeBoon({ ...run, hp: START_HP }, heal.id).hp).toBe(START_HP);
  });

  it("nhận trợ giúp khiên thì cộng khiên và giữ nguyên qua các tầng", () => {
    const sh = BOONS.find((b) => (b.effect.shield ?? 0) > 0);
    if (!sh) return;
    const after = takeBoon({ ...baseRun(), shield: 5 }, sh.id);
    expect(after.shield).toBe(5 + (sh.effect.shield ?? 0));
  });

  it("trợ giúp thêm giây làm tăng thời lượng của tầng", () => {
    const t = BOONS.find((b) => (b.effect.timeBonus ?? 0) > 0);
    const base = stageSeconds([]);
    if (!t) return;
    expect(stageSeconds([t.id])).toBeGreaterThan(base);
  });
});
