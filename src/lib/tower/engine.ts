/**
 * Bộ máy Leo Tháp chạy tại máy người dùng — thuần, không mạng, không Supabase.
 * Dựng phiên từ hạt ngẫu nhiên + gói đề + trạng thái cá nhân, rồi chấm tại chỗ.
 */
import type { AnswerValue } from "@/lib/questionKinds";
import type { BankQuestion, QuestionBank } from "@/lib/tower/bank";
import { correctTextOfBank } from "@/lib/tower/bank";
import {
  BOONS,
  QUESTIONS_PER_RUN,
  QUESTIONS_PER_STAGE,
  START_HP,
  STAGES_PER_RUN,
  STOP_WRONG_RATIO,
  offerBoons,
  type Boon,
} from "@/lib/tower/config";
import { gradeLocal } from "@/lib/tower/grade.local";
import { seededRandom, towerDamage } from "@/lib/tower/rng";
import { dueCardIds, type TowerState } from "@/lib/tower/state";

export type TowerRun = {
  seed: string;
  startedAt: string;
  questions: BankQuestion[];
  stage: number;
  hp: number;
  shield: number;
  combo: number;
  correct: number;
  answered: number;
  boons: string[];
  offered: Boon[];
  finished: boolean;
};

export type StageOutcome = {
  results: {
    questionId: string;
    correct: boolean;
    fraction: number;
    answered: boolean;
    correctText: string;
    explanation: string;
    tags: string[];
  }[];
  damage: number;
  softStop: boolean;
};

function shuffleIndices(n: number, rand: () => number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** Xáo phương án và viết lại đáp án theo không gian hiển thị. */
export function presentQuestion(q: BankQuestion, rand: () => number): BankQuestion {
  if (q.kind === "matching") {
    const rights = q.pairs.map((p) => p.right);
    const order = shuffleIndices(rights.length, rand); // order[display] = gốc
    const options = order.map((o) => rights[o] ?? "");
    const answerIndices = q.pairs.map((_, left) => order.indexOf(left));
    return { ...q, options, answerIndices };
  }
  if (q.kind === "fill_blank") return q;

  const n = q.options.length;
  if (n < 2) return q;
  const order = shuffleIndices(n, rand);
  const at = (base: number) => order.indexOf(base);
  return {
    ...q,
    options: order.map((o) => q.options[o] ?? ""),
    optionImages: order.map((o) => q.optionImages[o] ?? ""),
    answerIndex: at(q.answerIndex),
    answerIndices: q.answerIndices.map(at).filter((i) => i >= 0),
    correctOrder: (q.correctOrder.length ? q.correctOrder : q.options.map((_, i) => i)).map(at),
  };
}

function boonTotals(ids: string[]) {
  return ids.reduce(
    (acc, id) => {
      const b = BOONS.find((x) => x.id === id);
      if (!b) return acc;
      return {
        heal: acc.heal + (b.effect.heal ?? 0),
        shield: acc.shield + (b.effect.shield ?? 0),
        damageBonus: acc.damageBonus + (b.effect.damageBonus ?? 0),
        timeBonus: acc.timeBonus + (b.effect.timeBonus ?? 0),
      };
    },
    { heal: 0, shield: 0, damageBonus: 0, timeBonus: 0 },
  );
}

/** Xếp thứ tự ưu tiên: thẻ đến hạn → thẻ mới → thẻ chưa tới hạn. */
export function pickRunQuestions(
  bank: QuestionBank,
  state: TowerState,
  rand: () => number,
  now: Date = new Date(),
  limit: number = QUESTIONS_PER_RUN,
): BankQuestion[] {
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  const due = dueCardIds(state, now)
    .map((id) => byId.get(id))
    .filter((q): q is BankQuestion => Boolean(q));

  const seen = new Set(Object.keys(state.cards));
  const fresh = bank.questions.filter((q) => !seen.has(q.id));
  const later = bank.questions.filter((q) => seen.has(q.id) && !due.some((d) => d.id === q.id));

  // Ưu tiên chủ đề đang yếu trong nhóm thẻ mới.
  const weakness = (q: BankQuestion) =>
    Math.min(...[...q.tags.map((t) => state.topics[t]?.[0] ?? 1200), 1200]);
  const freshSorted = [...fresh].sort((a, b) => weakness(a) - weakness(b));

  const pool = [...due, ...freshSorted, ...later].slice(0, limit);
  // Trộn nhẹ thứ tự hiển thị để hai phiên liền nhau không giống hệt.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool;
}

export function createRun(bank: QuestionBank, state: TowerState, seed: string, now: Date = new Date()): TowerRun {
  const rand = seededRandom(seed);
  const picked = pickRunQuestions(bank, state, rand, now).map((q) => presentQuestion(q, rand));
  if (!picked.length) throw new Error("Chưa có câu hỏi nào để ôn tập.");
  return {
    seed,
    startedAt: now.toISOString(),
    questions: picked,
    stage: 0,
    hp: START_HP,
    shield: 0,
    combo: 0,
    correct: 0,
    answered: 0,
    boons: [],
    offered: offerBoons(rand),
    finished: false,
  };
}

/** Chấm một chặng ngay tại máy — 0 ms, không gọi máy chủ. */
export function gradeStage(
  run: TowerRun,
  answers: Record<string, AnswerValue>,
): { run: TowerRun; outcome: StageOutcome } {
  const from = run.stage * QUESTIONS_PER_STAGE;
  const slice = run.questions.slice(from, from + QUESTIONS_PER_STAGE);
  const totals = boonTotals(run.boons);
  const rand = seededRandom(`${run.seed}:${run.stage}`);

  let hp = run.hp + (run.stage === 0 ? totals.heal : 0);
  let shield = Math.max(run.shield, totals.shield);
  let combo = run.combo;
  let damage = 0;
  let correctCount = 0;

  const results: StageOutcome["results"] = slice.map((q, i) => {
    const value = answers[String(from + i)];
    const fraction = gradeLocal(q, value);
    const correct = fraction >= 1;
    if (correct) {
      correctCount++;
      combo++;
      damage += towerDamage({ roll: 1 + Math.floor(rand() * 12), combo, damageBonus: totals.damageBonus });
    } else {
      combo = 0;
      const absorbed = Math.min(shield, 10);
      shield -= absorbed;
      hp -= 10 - absorbed;
    }
    return {
      questionId: q.id,
      correct,
      fraction,
      answered: value !== undefined && value !== null && value !== "",
      correctText: correctTextOfBank(q),
      explanation: q.explanation,
      tags: q.tags,
    };
  });

  hp = Math.max(0, hp);
  const wrongRatio = 1 - correctCount / Math.max(1, slice.length);
  const softStop = wrongRatio > STOP_WRONG_RATIO;
  const nextStage = run.stage + 1;
  const finished = hp <= 0 || softStop || nextStage >= STAGES_PER_RUN;

  const nextRun: TowerRun = {
    ...run,
    stage: nextStage,
    hp,
    shield,
    combo,
    correct: run.correct + correctCount,
    answered: run.answered + results.filter((r) => r.answered).length,
    offered: finished ? [] : offerBoons(rand, run.boons),
    finished,
  };

  return { run: nextRun, outcome: { results, damage, softStop } };
}

export function takeBoon(run: TowerRun, boonId: string | undefined): TowerRun {
  if (!boonId || run.boons.includes(boonId) || !BOONS.some((b) => b.id === boonId)) return run;
  return { ...run, boons: [...run.boons, boonId] };
}
