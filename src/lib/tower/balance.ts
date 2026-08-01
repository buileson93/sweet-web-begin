/**
 * Bộ mô phỏng cân bằng Leo Tháp.
 *
 * Chạy hàng loạt hành trình bằng chính bộ máy thật (cùng hạt → cùng kết quả)
 * với một "người chơi giả" có tỉ lệ trả lời đúng cho trước. Nhờ vậy chỉnh
 * độ khó bằng số liệu chứ không bằng cảm tính.
 */
import type { QuestionBank } from "@/lib/tower/bank";
import {
  chooseRoom,
  createRun,
  floorOptions,
  gradeStage,
  leaveRoom,
  restAtCampfire,
  resolveEvent,
  roomQuestions,
  skipBlessing,
  takeCurse,
  takeRelic,
  type TowerRun,
} from "@/lib/tower/engine";
import { FLOORS } from "@/lib/tower/map";
import { seededRandom } from "@/lib/tower/rng";
import { emptyState, type TowerState } from "@/lib/tower/state";

export type SimOptions = {
  runs?: number;
  /** Tỉ lệ trả lời đúng của người chơi giả (0–1). */
  accuracy?: number;
  ascension?: number;
  seedPrefix?: string;
  state?: TowerState;
};

export type SimResult = {
  runs: number;
  accuracy: number;
  ascension: number;
  /** Tỉ lệ chinh phục đỉnh tháp (%). */
  winRate: number;
  avgFloors: number;
  avgScore: number;
  avgHp: number;
  /** Tỉ lệ hành trình vượt qua từng tầng (%). */
  survivalByFloor: number[];
  relicPicks: { id: string; count: number }[];
  cursePicks: { id: string; count: number }[];
};

/** Chơi một hành trình bằng chiến thuật đơn giản nhưng hợp lý. */
export function simulateRun(
  bank: QuestionBank,
  seed: string,
  accuracy: number,
  ascension: number,
  state: TowerState = emptyState(),
): TowerRun {
  const rand = seededRandom(`${seed}::sim`);
  let run = createRun(bank, state, seed, new Date(0), { ascension });
  let guard = 0;

  while (!run.finished && guard++ < FLOORS * 6) {
    const options = floorOptions(run);
    if (!options.length) break;
    // An toàn thấp thì ưu tiên phòng nghỉ ca, còn lại ưu tiên phòng có câu hỏi để lên điểm.
    const lowHp = run.hp / run.maxHp < 0.5;
    const idx = lowHp
      ? Math.max(0, options.findIndex((r) => r.kind === "campfire"))
      : Math.max(0, options.findIndex((r) => r.questions > 0));
    run = chooseRoom(run, idx);
    const room = run.room;
    if (!room) break;

    if (room.questions > 0) {
      const answers: Record<string, number> = {};
      roomQuestions(run).forEach((q, i) => {
        const right = rand() < accuracy;
        answers[String(i)] = right ? q.answerIndex : (q.answerIndex + 1) % Math.max(2, q.options.length);
      });
      run = gradeStage(run, answers).run;
      if (run.finished) break;
      // Nhận trang bị đầu tiên được mời; yếu tố bất lợi nhẹ thì nhận để đổi tín chỉ.
      if (run.offered.length) run = takeRelic(run, run.offered[0]?.id);
      if (run.offered.length) run = skipBlessing(run);
      if (run.curseOffer) run = takeCurse(run, run.curseOffer.coins >= 80);
    } else if (room.kind === "campfire") {
      run = restAtCampfire(run, "heal");
    } else if (room.kind === "event") {
      run = resolveEvent(run, "leave").run;
      run = leaveRoom(run);
    } else {
      run = leaveRoom(run);
    }
  }
  return run;
}

export function simulateRuns(bank: QuestionBank, opts: SimOptions = {}): SimResult {
  const runs = Math.max(1, opts.runs ?? 50);
  const accuracy = Math.min(1, Math.max(0, opts.accuracy ?? 0.75));
  const ascension = Math.max(0, opts.ascension ?? 0);
  const prefix = opts.seedPrefix ?? "sim";

  const reached = new Array<number>(FLOORS).fill(0);
  const relics = new Map<string, number>();
  const curses = new Map<string, number>();
  let wins = 0;
  let floors = 0;
  let score = 0;
  let hp = 0;

  for (let i = 0; i < runs; i++) {
    const run = simulateRun(bank, `${prefix}-${i}`, accuracy, ascension, opts.state ?? emptyState());
    const cleared = Math.max(0, Math.min(FLOORS, run.floor - 1));
    for (let f = 0; f < cleared; f++) reached[f] = (reached[f] ?? 0) + 1;
    floors += cleared;
    score += run.score;
    hp += run.hp;
    if (run.win) wins++;
    for (const id of run.relics) relics.set(id, (relics.get(id) ?? 0) + 1);
    for (const id of run.curses) curses.set(id, (curses.get(id) ?? 0) + 1);
  }

  const pct = (n: number) => Math.round((n / runs) * 100);
  const toList = (m: Map<string, number>) =>
    [...m.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);

  return {
    runs,
    accuracy,
    ascension,
    winRate: pct(wins),
    avgFloors: Math.round((floors / runs) * 10) / 10,
    avgScore: Math.round(score / runs),
    avgHp: Math.round(hp / runs),
    survivalByFloor: reached.map(pct),
    relicPicks: toList(relics),
    cursePicks: toList(curses),
  };
}
