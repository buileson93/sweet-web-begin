import { describe, expect, it } from "vitest";

import type { BankQuestion, QuestionBank } from "@/lib/tower/bank";
import { START_HP } from "@/lib/tower/config";
import {
  chooseRoom,
  createRun,
  gradeStage,
  presentQuestion,
  pickRunQuestions,
  roomQuestions,
  roomSeconds,
  takeCurse,
  takeRelic,
} from "@/lib/tower/engine";
import { BOSS_FLOORS, buildMap, FLOORS } from "@/lib/tower/map";
import { relicTotals } from "@/lib/tower/relics";
import { runScore } from "@/lib/tower/score";
import { gradeLocal } from "@/lib/tower/grade.local";
import { seededRandom } from "@/lib/tower/rng";
import { applyResults, dueCardIds, emptyState, mergeStates, normalizeState, pruneState } from "@/lib/tower/state";

const base = (over: Partial<BankQuestion> = {}): BankQuestion => ({
  id: "q1",
  quizId: "quiz-1",
  quizTitle: "Bộ đề mẫu",
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

  const enterCombat = (seed: string) => {
    let run = createRun(bank, emptyState(), seed);
    const floor = run.map[0]!;
    const at = floor.findIndex((r) => r.questions > 0);
    run = chooseRoom(run, at);
    return run;
  };

  it("ưu tiên thẻ đến hạn trước thẻ mới", () => {
    const state = normalizeState({ cards: { q30: [1, "2020-01-01"] } });
    const picked = pickRunQuestions(bank, state, seededRandom("x"), new Date("2026-01-01"), 5);
    expect(picked.map((q) => q.id)).toContain("q30");
  });

  it("chấm phòng: đúng hết thì không mất máu và lên tầng", () => {
    const run = enterCombat("seed-1");
    const qs = roomQuestions(run);
    const answers = Object.fromEntries(qs.map((q, i) => [String(i), q.answerIndex]));
    const { run: next, outcome } = gradeStage(run, answers);
    expect(next.hp).toBe(run.maxHp);
    expect(outcome.results.every((r) => r.correct)).toBe(true);
    expect(outcome.damage).toBeGreaterThan(0);
    expect(next.floor).toBe(2);
    expect(next.offered.length).toBeGreaterThan(0);
  });

  it("bỏ trống hết thì mất máu, có thể kết thúc hành trình", () => {
    const run = enterCombat("seed-2");
    const { run: next, outcome } = gradeStage(run, {});
    expect(outcome.results.every((r) => !r.correct)).toBe(true);
    expect(next.hp).toBeLessThan(run.maxHp);
  });

  it("cùng hạt ngẫu nhiên cho cùng một hành trình", () => {
    const a = createRun(bank, emptyState(), "same");
    const b = createRun(bank, emptyState(), "same");
    expect(a.questions.map((q) => q.id)).toEqual(b.questions.map((q) => q.id));
    expect(JSON.stringify(a.map)).toEqual(JSON.stringify(b.map));
  });

  it("thời lượng phòng tỉ lệ với số câu", () => {
    const run = enterCombat("seed-3");
    expect(roomSeconds(run)).toBeGreaterThan(0);
  });
});

describe("bản đồ phân nhánh 12 tầng", () => {
  it("đủ 12 tầng, trùm đúng vị trí, tầng trước trùm luôn có lửa trại", () => {
    const map = buildMap("map-seed");
    expect(map).toHaveLength(FLOORS);
    for (const f of BOSS_FLOORS) {
      expect(map[f - 1]!.map((r) => r.kind)).toEqual(["boss"]);
      expect(map[f - 2]!.some((r) => r.kind === "campfire")).toBe(true);
    }
    // Mọi phòng đều có trắc nghiệm: hoặc câu giao tranh, hoặc một câu thử thách.
    for (const floor of map)
      expect(floor.every((r) => r.questions + ROOM_RULES[r.kind].challenge > 0)).toBe(true);
  });

  it("mọi nút đều nối lên tầng trên và không có cạnh cắt nhau", () => {
    const map = buildMap("graph-seed");
    for (let f = 0; f < FLOORS - 1; f++) {
      const row = map[f]!;
      const upper = map[f + 1]!;
      for (const node of row) expect(node.next.length).toBeGreaterThan(0);
      const edges = row.flatMap((n) => n.next.map((i) => [n.col, upper[i]!.col] as const));
      for (const [a, b] of edges)
        for (const [c, d] of edges) expect((a < c && b > d) || (a > c && b < d)).toBe(false);
    }
  });

  it("cùng hạt cho cùng bản đồ, khác hạt thì khác", () => {
    expect(JSON.stringify(buildMap("a"))).toBe(JSON.stringify(buildMap("a")));
    expect(JSON.stringify(buildMap("a"))).not.toBe(JSON.stringify(buildMap("b")));
  });
});


describe("di vật, lời nguyền và điểm hành trình", () => {
  const bank: QuestionBank = {
    version: 1,
    builtAt: new Date().toISOString(),
    questions: Array.from({ length: 40 }, (_, i) => base({ id: `q${i}` })),
  };

  it("nhận di vật thì cộng dồn hiệu ứng", () => {
    let run = createRun(bank, emptyState(), "relic-seed");
    run = { ...run, offered: [...run.offered], hp: 40 };
    const floor = run.map[0]!;
    run = chooseRoom(run, floor.findIndex((r) => r.questions > 0));
    const graded = gradeStage(run, Object.fromEntries(roomQuestions(run).map((q, i) => [String(i), q.answerIndex])));
    const offer = graded.run.offered[0]!;
    const after = takeRelic(graded.run, offer.id);
    expect(after.relics).toContain(offer.id);
    expect(relicTotals(after.relics).minRoll).toBeGreaterThanOrEqual(1);
  });

  it("nhận lời nguyền thì được xu, từ chối thì không", () => {
    const run = createRun(bank, emptyState(), "curse-seed");
    const withOffer = { ...run, curseOffer: { curseId: "mu-suong", coins: 80 } };
    expect(takeCurse(withOffer, true).curses).toContain("mu-suong");
    expect(takeCurse(withOffer, true).coins).toBe(run.coins + 80);
    expect(takeCurse(withOffer, false).curses).toHaveLength(run.curses.length);
  });

  it("điểm hành trình theo đúng công thức khoá cứng", () => {
    expect(runScore({ floorsCleared: 3, hp: 50, relics: ["a", "b"], curses: [] })).toBe(3 * 100 + 50 * 2 + 30);
    expect(runScore({ floorsCleared: 0, hp: 0, relics: [], curses: [], ascension: 2 })).toBe(0);
  });

  it("máu khởi đầu mặc định bằng hằng số cấu hình", () => {
    const run = createRun(bank, emptyState(), "hp-seed");
    expect(run.maxHp).toBe(START_HP);
  });
});
