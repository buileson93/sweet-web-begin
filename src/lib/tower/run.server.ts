import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyEmployee } from "@/lib/employees.server";
import {
  baseOptions,
  correctTextOf,
  gradeFraction,
  optionImagesOf,
  pairsOf,
  permuteByOrder,
  shuffle,
  type QuestionRow,
} from "@/lib/grading";
import { QUESTION_COLUMNS } from "@/lib/exam/types";
import type { AnswerValue } from "@/lib/questionKinds";
import { offerBoons, BOONS, QUESTIONS_PER_RUN, QUESTIONS_PER_STAGE, START_HP, STAGES_PER_RUN, STOP_WRONG_RATIO } from "@/lib/tower/config";
import { seededRandom, towerDamage } from "@/lib/tower/rng";
import { logReviews } from "@/lib/review/log.server";
import { applyReviewBatch } from "@/lib/tower/due.server";

export type TowerQuestion = {
  id: string;
  kind: QuestionRow["kind"];
  question: string;
  options: string[];
  matchLeft: string[];
  imageUrl: string | null;
  imageAlt: string;
  optionImages: string[];
};

type RunState = {
  token: string;
  questionIds: string[];
  optionOrders: number[][];
  boons: string[];
  combo: number;
  shield: number;
};

const nowIso = () => new Date().toISOString();

function toTowerQuestion(row: QuestionRow, order: number[]): TowerQuestion {
  const opts = baseOptions(row);
  return {
    id: row.id,
    kind: row.kind,
    question: row.question,
    options: permuteByOrder(opts, order, ""),
    matchLeft: pairsOf(row).map((p) => p.left),
    imageUrl: row.image_url ?? null,
    imageAlt: (row as { image_alt?: string }).image_alt ?? "",
    optionImages: permuteByOrder(optionImagesOf(row), order, ""),
  };
}

function readState(raw: unknown): RunState {
  const s = (raw ?? {}) as Partial<RunState>;
  return {
    token: s.token ?? "",
    questionIds: s.questionIds ?? [],
    optionOrders: s.optionOrders ?? [],
    boons: s.boons ?? [],
    combo: s.combo ?? 0,
    shield: s.shield ?? 0,
  };
}

/** Tổng cộng dồn hiệu ứng của các trợ học đã chọn. */
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

/** Mở phiên leo tháp: 1 lần chọn câu cho cả phiên, không realtime, không job nền. */
export async function startTowerRun(input: {
  name: string;
  credential: string;
  extraCredential?: string;
  quizId?: string;
}) {
  const employee = await verifyEmployee(input);

  // Đóng các phiên còn treo để không tồn tại hai phiên song song.
  await supabaseAdmin
    .from("tower_runs")
    .update({ status: "abandoned", finished_at: nowIso() })
    .eq("employee_id", employee.id)
    .eq("status", "active");

  // 1 truy vấn hàng đợi đến hạn (lấy dư gấp ba nhu cầu).
  const { data: dueRows } = await supabaseAdmin
    .from("learner_cards")
    .select("question_id, next_due_at")
    .eq("employee_id", employee.id)
    .lte("next_due_at", nowIso())
    .order("next_due_at", { ascending: true })
    .limit(QUESTIONS_PER_RUN * 3);

  const dueIds = (dueRows ?? []).map((r) => r.question_id as string);

  let rows: QuestionRow[] = [];
  if (dueIds.length) {
    const { data } = await supabaseAdmin
      .from("questions")
      .select(QUESTION_COLUMNS)
      .in("id", dueIds.slice(0, QUESTIONS_PER_RUN * 3))
      .eq("is_archived", false);
    rows = (data ?? []) as unknown as QuestionRow[];
  }

  // Bù thẻ mới nếu hàng đợi chưa đủ.
  if (rows.length < QUESTIONS_PER_RUN) {
    let q = supabaseAdmin
      .from("questions")
      .select(QUESTION_COLUMNS)
      .eq("is_archived", false)
      .limit(400);
    if (input.quizId) q = q.eq("quiz_id", input.quizId);
    const { data } = await q;
    const have = new Set(rows.map((r) => r.id));
    for (const r of ((data ?? []) as unknown as QuestionRow[])) {
      if (rows.length >= QUESTIONS_PER_RUN * 2) break;
      if (!have.has(r.id)) rows.push(r);
    }
  }

  if (!rows.length) throw new Error("Chưa có câu hỏi nào để ôn tập.");

  const seed = `${employee.id}:${Date.now()}`;
  const rand = seededRandom(seed);
  const picked = shuffle(rows, Math.floor(rand() * 1e9)).slice(0, QUESTIONS_PER_RUN);

  const optionOrders = picked.map((row) => {
    const n = baseOptions(row).length;
    return shuffle(
      Array.from({ length: n }, (_, i) => i),
      Math.floor(rand() * 1e9),
    );
  });

  const token = crypto.randomUUID();
  const state: RunState = {
    token,
    questionIds: picked.map((r) => r.id),
    optionOrders,
    boons: [],
    combo: 0,
    shield: 0,
  };

  const { data: run, error } = await supabaseAdmin
    .from("tower_runs")
    .insert({
      employee_id: employee.id,
      quiz_id: input.quizId ?? null,
      seed,
      state: state as never,
      hp: START_HP,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !run) throw new Error(error?.message ?? "Không mở được phiên leo tháp.");

  return {
    runId: run.id as string,
    token,
    candidateName: employee.fullName,
    hp: START_HP,
    stages: STAGES_PER_RUN,
    perStage: QUESTIONS_PER_STAGE,
    dueCount: dueIds.length,
    /** Toàn bộ đề của phiên, KHÔNG kèm đáp án đúng. */
    questions: picked.map((row, i) => toTowerQuestion(row, optionOrders[i]!)),
    boons: offerBoons(rand),
  };
}

/** Chấm cả một chặng trong MỘT lượt đi về; cập nhật thẻ ghi nhớ theo lô. */
export async function submitTowerStage(input: {
  runId: string;
  token: string;
  stageIndex: number;
  answers: Record<string, AnswerValue>;
  msTaken?: Record<string, number>;
  boonId?: string;
}) {
  const { data: run } = await supabaseAdmin
    .from("tower_runs")
    .select("id, employee_id, state, hp, status, stage_index, correct, answered, version")
    .eq("id", input.runId)
    .maybeSingle();

  const state = readState(run?.state);
  if (!run || run.status !== "active" || state.token !== input.token)
    throw new Error("Phiên leo tháp không hợp lệ.");
  if (input.stageIndex !== run.stage_index) throw new Error("Chặng không khớp.");

  if (input.boonId && BOONS.some((b) => b.id === input.boonId) && !state.boons.includes(input.boonId))
    state.boons.push(input.boonId);
  const totals = boonTotals(state.boons);

  const from = input.stageIndex * QUESTIONS_PER_STAGE;
  const ids = state.questionIds.slice(from, from + QUESTIONS_PER_STAGE);

  const { data: rowsRaw } = await supabaseAdmin
    .from("questions")
    .select(QUESTION_COLUMNS)
    .in("id", ids);
  const byId = new Map(((rowsRaw ?? []) as unknown as QuestionRow[]).map((r) => [r.id, r]));

  const rand = seededRandom(`${input.runId}:${input.stageIndex}`);
  let hp = run.hp + (input.stageIndex === 0 ? totals.heal : 0);
  let shield = Math.max(state.shield, totals.shield);
  let combo = state.combo;
  let correctCount = 0;
  let damage = 0;

  const results = ids.map((qid, i) => {
    const row = byId.get(qid);
    const order = state.optionOrders[from + i] ?? [];
    const value = input.answers[String(from + i)];
    const answered = value !== undefined && value !== null && value !== "";
    const fraction = row ? gradeFraction(row, order, value) : 0;
    const correct = fraction >= 1;

    if (correct) {
      correctCount++;
      combo++;
      damage += towerDamage({
        roll: 1 + Math.floor(rand() * 12),
        combo,
        damageBonus: totals.damageBonus,
      });
    } else {
      combo = 0;
      const hit = 10;
      const absorbed = Math.min(shield, hit);
      shield -= absorbed;
      hp -= hit - absorbed;
    }

    return {
      questionId: qid,
      correct,
      fraction,
      answered,
      correctText: row ? correctTextOf(row) : "",
      explanation: row?.explanation ?? "",
    };
  });

  hp = Math.max(0, hp);
  const wrongRatio = 1 - correctCount / Math.max(1, ids.length);
  const nextStage = input.stageIndex + 1;
  const softStop = wrongRatio > STOP_WRONG_RATIO;
  const finished = hp <= 0 || softStop || nextStage >= STAGES_PER_RUN;

  const nextState: RunState = { ...state, combo, shield };

  await supabaseAdmin
    .from("tower_runs")
    .update({
      state: nextState as never,
      hp,
      stage_index: nextStage,
      correct: run.correct + correctCount,
      answered: run.answered + results.filter((r) => r.answered).length,
      version: run.version + 1,
      status: finished ? "finished" : "active",
      finished_at: finished ? nowIso() : null,
    })
    .eq("id", run.id)
    .eq("version", run.version);

  await supabaseAdmin.from("tower_run_events").insert({
    run_id: run.id,
    seq: input.stageIndex,
    kind: "stage",
    payload: { correct: correctCount, damage, hp, softStop } as never,
  });

  // Ghi lô: nhật ký + lịch ôn (không chặn, lỗi không ảnh hưởng người chơi).
  await logReviews(
    run.employee_id as string,
    "tower",
    results.map((r) => ({
      id: r.questionId,
      fraction: r.fraction,
      answered: r.answered,
      msTaken: input.msTaken?.[r.questionId] ?? 0,
    })),
  );
  await applyReviewBatch(
    run.employee_id as string,
    results.map((r) => ({ questionId: r.questionId, correct: r.correct })),
  );

  return {
    results,
    hp,
    shield,
    combo,
    damage,
    finished,
    softStop,
    nextStage,
    boons: finished ? [] : offerBoons(rand, state.boons),
  };
}

/** Tổng kết phiên: "hôm nay bạn đã học được gì". */
export async function finishTowerRun(input: { runId: string; token: string }) {
  const { data: run } = await supabaseAdmin
    .from("tower_runs")
    .select("id, employee_id, state, hp, correct, answered, stage_index, started_at, status")
    .eq("id", input.runId)
    .maybeSingle();

  const state = readState(run?.state);
  if (!run || state.token !== input.token) throw new Error("Phiên leo tháp không hợp lệ.");

  if (run.status === "active") {
    await supabaseAdmin
      .from("tower_runs")
      .update({ status: "finished", finished_at: nowIso() })
      .eq("id", run.id);
  }

  const { count: due } = await supabaseAdmin
    .from("learner_cards")
    .select("question_id", { count: "exact", head: true })
    .eq("employee_id", run.employee_id as string)
    .lte("next_due_at", nowIso());

  return {
    stagesCleared: run.stage_index as number,
    correct: run.correct as number,
    answered: run.answered as number,
    hp: run.hp as number,
    boons: state.boons,
    remainingDue: due ?? 0,
  };
}
