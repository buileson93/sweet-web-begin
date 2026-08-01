/**
 * Bộ máy Leo Tháp chạy tại máy người dùng — thuần, không mạng, không Supabase.
 *
 * Toàn bộ hành trình dựng lại được từ MỘT hạt ngẫu nhiên: bản đồ, di vật rút được,
 * lời nguyền, phòng sự kiện. Nhờ vậy có thử thách hằng ngày, chống gian lận và xem lại.
 */
import type { AnswerValue } from "@/lib/questionKinds";
import type { BankQuestion, QuestionBank } from "@/lib/tower/bank";
import { correctTextOfBank } from "@/lib/tower/bank";
import { bossAt } from "@/lib/tower/bosses";
import { QUESTIONS_PER_RUN, SECONDS_PER_QUESTION, START_HP } from "@/lib/tower/config";
import { curseTotals, offerCurse } from "@/lib/tower/curses";
import { gradeLocal } from "@/lib/tower/grade.local";
import { FLOORS, isBossFloor, type MapNode, mapFor, reachableAt, type Room, type RoomKind } from "@/lib/tower/map";
import { comboRewardAt, ROOM_RULES, wrongDamage, type ComboReward } from "@/lib/tower/rooms";
import { ascensionMods, relicPoolIds } from "@/lib/tower/meta";
import { offerRelics, RELICS, relicTotals, type Relic } from "@/lib/tower/relics";
import { branch, seededRandom, towerDamage } from "@/lib/tower/rng";
import { runScore } from "@/lib/tower/score";
import { dueCardIds, type TowerState } from "@/lib/tower/state";

/** Số câu tối đa một hành trình 12 tầng có thể tiêu thụ. */
export const MAX_RUN_QUESTIONS = 84;

export type TowerRun = {
  seed: string;
  daily: boolean;
  ascension: number;
  startedAt: string;
  /** Bể câu hỏi của cả hành trình; phòng nào lấy tới đâu thì con trỏ chạy tới đó. */
  questions: BankQuestion[];
  cursor: number;
  floor: number;
  map: MapNode[][];
  path: RoomKind[];
  /** Chỉ số nút đã chọn ở từng tầng — dùng để giới hạn lối đi và tô đường đã qua. */
  trail: number[];
  /** Nút đang đứng ở tầng hiện tại (null khi chưa chọn). */
  node: number | null;
  room: Room | null;
  /** Câu thử thách của phòng không giao tranh: chỉ số câu + kết quả. */
  challenge: { slot: number; done: boolean; correct: boolean } | null;
  /** Chỉ số câu hỏi của phòng đang chơi (trỏ vào `questions`). */
  slots: number[];
  hp: number;
  maxHp: number;
  shield: number;
  combo: number;
  correct: number;
  answered: number;
  relics: string[];
  curses: string[];
  offered: Relic[];
  curseOffer: { curseId: string; coins: number } | null;
  coins: number;
  revived: boolean;
  blocksLeft: number;
  finished: boolean;
  win: boolean;
  score: number;
  /** Danh sách di vật đã mở khoá ở tiến trình meta (rỗng = chỉ dùng bể mặc định). */
  unlockedPool?: string[];
  /** Nhật ký diễn biến — đủ để dựng lại toàn bộ hành trình từ hạt. */
  log: RunEvent[];
};

/** Một mốc diễn biến trong hành trình (dùng cho màn xem lại). */
export type RunEvent = {
  /** Thời điểm tương đối tính bằng giây kể từ lúc vào tháp. */
  t: number;
  floor: number;
  kind:
    | "start"
    | "room"
    | "combat"
    | "relic"
    | "skip"
    | "curse"
    | "campfire"
    | "event"
    | "shop"
    | "end";
  label: string;
  detail?: string;
  hp?: number;
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
  /** Máu đã mất trong phòng (sau mọi hệ số) — hiển thị cho người chơi thấy rõ. */
  hpLost: number;
  /** Các mốc chuỗi đúng đã đạt trong phòng. */
  combos: ComboReward[];
};

const ROOM_LABEL: Record<RoomKind, string> = {
  combat: "giao tranh",
  elite: "tinh anh",
  event: "sự kiện",
  shop: "cửa hàng",
  campfire: "lửa trại",
  boss: "trùm",
};

/** Nối một mốc vào nhật ký, tự tính mốc thời gian tương đối. */
export function logged(run: TowerRun, ev: Omit<RunEvent, "t">): RunEvent[] {
  const t = Math.max(0, Math.round((Date.now() - new Date(run.startedAt).getTime()) / 1000));
  return [...(run.log ?? []), { t, ...ev }];
}

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

/** Tổng hợp mọi hệ số đang tác động lên hành trình: di vật + lời nguyền + trùm + thăng thiên. */
export function runModifiers(run: TowerRun) {
  const relics = relicTotals(run.relics);
  const curses = curseTotals(run.curses);
  const asc = ascensionMods(run.ascension);
  const boss = run.room?.kind === "boss" ? bossAt(run.floor)?.effect : undefined;

  return {
    relics,
    curses,
    asc,
    boss,
    timePct: relics.timePct + curses.timePct + asc.timePct + (boss?.timePct ?? 0),
    damageTakenPct: (boss?.damageTakenPct ?? 0) + asc.damageTakenPct,
    damageReducePct: relics.damageReducePct + curses.damageReducePct,
    noHeal: curses.noHeal || Boolean(boss?.noHeal),
    skillSlow: curses.skillSlow + (boss?.skillSlow ?? 0),
    silence: curses.silence,
    coinPct: relics.coinPct + curses.coinPct,
    noRevive: asc.noRevive,
  };
}

/** Số giây cho phòng đang chơi, đã tính di vật, lời nguyền và luật trùm. */
export function roomSeconds(run: TowerRun): number {
  const n = run.room?.questions ?? 0;
  const mods = runModifiers(run);
  return Math.max(8, Math.round(SECONDS_PER_QUESTION * n * (1 + mods.timePct)));
}

export function createRun(
  bank: QuestionBank,
  state: TowerState,
  seed: string,
  now: Date = new Date(),
  opts: { daily?: boolean; ascension?: number; unlocked?: string[] } = {},
): TowerRun {
  const rand = branch(seed, "questions");
  const picked = pickRunQuestions(bank, state, rand, now, MAX_RUN_QUESTIONS).map((q) =>
    presentQuestion(q, rand),
  );
  if (!picked.length) throw new Error("Chưa có câu hỏi nào để ôn tập.");
  const asc = ascensionMods(opts.ascension ?? 0);
  const maxHp = Math.max(40, START_HP + asc.startHpDelta);

  const run: TowerRun = {
    seed,
    daily: Boolean(opts.daily),
    ascension: Math.max(0, opts.ascension ?? 0),
    startedAt: now.toISOString(),
    questions: picked,
    cursor: 0,
    floor: 1,
    map: mapFor(seed),
    path: [],
    trail: [],
    node: null,
    room: null,
    challenge: null,
    slots: [],
    hp: maxHp,
    maxHp,
    shield: 0,
    combo: 0,
    correct: 0,
    answered: 0,
    relics: [],
    curses: [],
    offered: [],
    curseOffer: null,
    coins: 0,
    revived: false,
    blocksLeft: 0,
    finished: false,
    win: false,
    score: 0,
    log: [],
  };
  run.log.push({ t: 0, floor: 1, kind: "start", label: "Bước vào tháp", detail: `Hạt ${seed}`, hp: maxHp });
  // Thăng thiên cấp 8 trở lên: bắt buộc mang một lời nguyền ngay từ cửa tháp.
  if (asc.forcedCurse) {
    const forced = offerCurse(branch(seed, "forced-curse"));
    if (forced) run.curses = [forced.curse.id];
  }
  run.unlockedPool = relicPoolIds(opts.unlocked ?? []);
  return run;
}

/** Chọn phòng ở tầng hiện tại; phòng có câu hỏi thì phát đề luôn. */
export function chooseRoom(run: TowerRun, index: number): TowerRun {
  const choices = floorChoices(run);
  const pick = choices[index] ?? choices[0];
  if (!pick || run.finished) return run;
  const room = pick.room;

  const mods = relicTotals(run.relics);
  const slots: number[] = [];
  let cursor = run.cursor;
  const need = room.questions + ROOM_RULES[room.kind].challenge;
  for (let i = 0; i < need; i++) {
    slots.push(cursor % run.questions.length);
    cursor++;
  }
  const challenge =
    ROOM_RULES[room.kind].challenge > 0 ? { slot: slots.length - 1, done: false, correct: false } : null;

  return {
    ...run,
    room,
    slots,
    cursor,
    node: pick.index,
    trail: [...(run.trail ?? []), pick.index],
    path: [...run.path, room.kind],
    blocksLeft: mods.blockPerFloor,
    offered: [],
    curseOffer: null,
    challenge,
    log: logged(run, {
      floor: run.floor,
      kind: "room",
      label: `Tầng ${run.floor} — vào phòng ${ROOM_LABEL[room.kind]}`,
      detail: ROOM_RULES[room.kind].rule,
      hp: run.hp,
    }),
  };
}

/** Câu thử thách kiến thức của phòng không giao tranh. */
export function challengeQuestion(run: TowerRun): BankQuestion | null {
  if (!run.challenge) return null;
  const i = run.slots[run.challenge.slot];
  return i === undefined ? null : (run.questions[i] ?? null);
}

/**
 * Chấm câu thử thách của phòng sự kiện / cửa hàng / lửa trại.
 * Sai ở phòng sự kiện mất máu theo LUẬT PHÒNG; hai phòng kia chỉ mất ưu đãi.
 */
export function resolveChallenge(
  run: TowerRun,
  value: AnswerValue,
): { run: TowerRun; correct: boolean; message: string; result: StageOutcome["results"][number] | null } {
  const q = challengeQuestion(run);
  if (!run.room || !run.challenge || run.challenge.done || !q) {
    return { run, correct: false, message: "", result: null };
  }
  const mods = runModifiers(run);
  const fraction = gradeLocal(q, value);
  const correct = fraction >= 1;
  const kind = run.room.kind;

  let hp = run.hp;
  let shield = run.shield;
  let coins = run.coins;
  let combo = correct ? run.combo + 1 : 0;
  let message = "";

  if (correct) {
    const reward = comboRewardAt(combo);
    if (reward) {
      hp = Math.min(run.maxHp, hp + (mods.noHeal ? 0 : (reward.hp ?? 0)));
      shield += reward.shield ?? 0;
      coins += reward.coins ?? 0;
    }
    if (kind === "event") {
      coins += 40;
      message = "Trả lời đúng — bạn nhận 40 xu và được chọn phương án tốt hơn.";
    } else if (kind === "shop") {
      message = "Mặc cả thành công — mọi món trong cửa hàng giảm 30%.";
    } else {
      message = "Ôn bài chuẩn — lửa trại hồi thêm 10% máu tối đa.";
    }
  } else {
    const loss = wrongDamage(kind, mods.damageTakenPct, mods.damageReducePct);
    if (loss > 0) {
      const absorbed = Math.min(shield, loss);
      shield -= absorbed;
      hp = Math.max(0, hp - (loss - absorbed));
    }
    message =
      kind === "event"
        ? `Chưa đúng — bạn mất ${loss} máu và bỏ lỡ phần thưởng.`
        : kind === "shop"
          ? "Chưa đúng — cửa hàng giữ nguyên giá gốc."
          : "Chưa đúng — lửa trại chỉ hồi mức cơ bản.";
  }

  const next: TowerRun = {
    ...run,
    hp,
    shield,
    coins,
    combo,
    answered: run.answered + 1,
    correct: run.correct + (correct ? 1 : 0),
    challenge: { ...run.challenge, done: true, correct },
    log: logged(run, {
      floor: run.floor,
      kind: kind === "shop" ? "shop" : kind === "campfire" ? "campfire" : "event",
      label: `Thử thách ${ROOM_LABEL[kind]} — ${correct ? "đúng" : "chưa đúng"}`,
      detail: message,
      hp,
    }),
  };

  return {
    run: hp <= 0 ? endRun(next) : next,
    correct,
    message,
    result: {
      questionId: q.id,
      correct,
      fraction,
      answered: value !== undefined && value !== null && value !== "",
      correctText: correctTextOfBank(q),
      explanation: q.explanation,
      tags: q.tags,
    },
  };
}

/** Khép lại hành trình khi gục ngã ngoài phòng giao tranh. */
function endRun(run: TowerRun): TowerRun {
  const next: TowerRun = { ...run, hp: 0, finished: true, win: false, room: null, slots: [], challenge: null };
  next.log = logged(run, { floor: run.floor, kind: "end", label: "Hành trình khép lại", hp: 0 });
  next.score = runScore({
    floorsCleared: Math.max(0, next.floor - 1),
    hp: 0,
    relics: next.relics,
    curses: next.curses,
    ascension: next.ascension,
  });
  return next;
}

/** Câu hỏi của phòng đang chơi, theo đúng thứ tự phát đề. */
export function roomQuestions(run: TowerRun): BankQuestion[] {
  const slots = run.challenge ? run.slots.slice(0, run.challenge.slot) : run.slots;
  return slots.map((i) => run.questions[i]!).filter(Boolean);
}

/** Chấm phòng giao tranh / tinh anh / trùm ngay tại máy — 0 ms, không gọi máy chủ. */
export function gradeStage(
  run: TowerRun,
  answers: Record<string, AnswerValue>,
): { run: TowerRun; outcome: StageOutcome } {
  const slice = roomQuestions(run);
  const mods = runModifiers(run);
  const rand = branch(run.seed, `combat-${run.floor}`);

  let hp = run.hp;
  let shield = run.shield;
  let combo = run.combo;
  let blocks = run.blocksLeft;
  let damage = 0;
  let correctCount = 0;
  let revived = run.revived;
  let coins = 0;
  let hpLost = 0;
  const combos: ComboReward[] = [];
  const kind = run.room?.kind ?? "combat";

  const results: StageOutcome["results"] = slice.map((q, i) => {
    const value = answers[String(i)];
    const fraction = gradeLocal(q, value);
    const correct = fraction >= 1;
    if (correct) {
      correctCount++;
      combo++;
      // Không sửa công thức gốc: chỉ hậu xử lý kết quả nó trả về.
      const roll = Math.max(mods.relics.minRoll, 1 + Math.floor(rand() * 12));
      let hit = towerDamage({ roll, combo, damageBonus: mods.relics.damageBonus });
      hit += mods.relics.comboDamage * Math.max(0, combo - 1);
      if (q.difficulty === "hard") hit += mods.relics.hardBonus;
      if (mods.relics.lowHpRagePct > 0 && hp / run.maxHp < 0.3) hit = Math.round(hit * (1 + mods.relics.lowHpRagePct));
      // Phần thưởng chuỗi đúng: mốc 3 · 5 · 7 · 10 (xem LUẬT PHÒNG trong rooms.ts).
      const reward = comboRewardAt(combo);
      if (reward) {
        combos.push(reward);
        if (reward.doubleDamage) hit *= 2;
        if (reward.hp && !mods.noHeal) hp = Math.min(run.maxHp, hp + reward.hp);
        if (reward.shield) shield += reward.shield;
        if (reward.coins) coins += reward.coins;
      }
      damage += hit;
    } else {
      combo = 0;
      if (blocks > 0) {
        blocks--; // Khiên băng chặn đứng một đòn mỗi tầng.
      } else {
        const incoming = wrongDamage(kind, mods.damageTakenPct, mods.damageReducePct);
        const absorbed = Math.min(shield, incoming);
        shield -= absorbed;
        hp -= incoming - absorbed;
        hpLost += incoming - absorbed;
        if (mods.relics.reflectPct > 0) damage += Math.round(incoming * mods.relics.reflectPct);
      }
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

  // Nghịch lưu: lần đầu gục ngã được hồi sinh (trừ thăng thiên cấp 10).
  if (hp <= 0 && !revived && mods.relics.revivePct > 0 && !mods.noRevive) {
    hp = Math.round(run.maxHp * mods.relics.revivePct);
    revived = true;
  }
  hp = Math.max(0, hp);

  const cleared = hp > 0;
  const nextFloor = run.floor + 1;
  const finished = !cleared || nextFloor > FLOORS;
  const win = cleared && nextFloor > FLOORS;

  // Xu nhặt được: tinh anh và trùm trả nhiều hơn.
  const base = run.room?.kind === "boss" ? 90 : run.room?.kind === "elite" ? 55 : 30;
  const coinGain = cleared ? Math.round(base * (1 + mods.coinPct)) : 0;

  let next: TowerRun = {
    ...run,
    hp,
    shield,
    combo,
    blocksLeft: blocks,
    revived,
    correct: run.correct + correctCount,
    answered: run.answered + results.filter((r) => r.answered).length,
    coins: run.coins + coinGain + coins,
    floor: cleared ? nextFloor : run.floor,
    room: null,
    slots: [],
    challenge: null,
    finished,
    win,
  };

  next.log = logged(run, {
    floor: run.floor,
    kind: "combat",
    label: `Tầng ${run.floor} — ${correctCount}/${slice.length} câu đúng`,
    detail: `Gây ${damage} sát thương${cleared ? "" : " · gục ngã"}`,
    hp: next.hp,
  });
  if (finished) {
    next.log = logged(next, {
      floor: run.floor,
      kind: "end",
      label: win ? "Chinh phục đỉnh tháp" : "Hành trình khép lại",
      detail: `Đúng ${next.correct}/${next.answered} câu`,
      hp: next.hp,
    });
  }
  if (cleared && !finished) next = withBlessing(next);
  next.score = runScore({
    floorsCleared: Math.max(0, next.floor - 1),
    hp: next.hp,
    relics: next.relics,
    curses: next.curses,
    ascension: next.ascension,
  });

  return { run: next, outcome: { results, damage, softStop: !cleared, hpLost, combos } };
}

/** Ban phước sau mỗi tầng thắng: rút 3 di vật theo trọng số hiếm, kèm cơ hội nhận lời nguyền. */
export function withBlessing(run: TowerRun): TowerRun {
  const prevFloor = run.floor - 1;
  const kind = run.path[run.path.length - 1];
  const tier = kind === "boss" ? "trum" : kind === "elite" ? "tinh-anh" : "thuong";
  const asc = ascensionMods(run.ascension);
  const pool = run.unlockedPool ?? relicPoolIds([]);
  const rand = branch(run.seed, `reward-${prevFloor}`);
  // Món chưa mở khoá được coi như "đã có" để không bao giờ rơi vào lượt rút.
  const locked = RELICS.filter((r) => !pool.includes(r.id)).map((r) => r.id);
  const offered = offerRelics(rand, [...run.relics, ...locked], tier, asc.relicChoices);

  // Cứ hai tầng lại có một lần chào mời đổi rủi ro lấy phần thưởng.
  let curseOffer: TowerRun["curseOffer"] = null;
  if (prevFloor % 2 === 0) {
    const offer = offerCurse(branch(run.seed, `curse-${prevFloor}`), run.curses);
    if (offer) curseOffer = { curseId: offer.curse.id, coins: offer.coins };
  }
  return { ...run, offered, curseOffer };
}

export function takeRelic(run: TowerRun, relicId: string | undefined): TowerRun {
  const relic = run.offered.find((r) => r.id === relicId);
  if (!relic || run.relics.includes(relic.id)) return run;
  const mods = runModifiers(run);
  const heal = mods.noHeal ? 0 : (relic.effect.heal ?? 0);
  return {
    ...run,
    relics: [...run.relics, relic.id],
    offered: [],
    hp: Math.min(run.maxHp, run.hp + heal),
    shield: run.shield + (relic.effect.shield ?? 0),
    log: logged(run, {
      floor: run.floor,
      kind: "relic",
      label: `Nhận di vật ${relic.name}`,
      detail: relic.desc,
      hp: run.hp,
    }),
  };
}

export function skipBlessing(run: TowerRun): TowerRun {
  return {
    ...run,
    offered: [],
    coins: run.coins + 25,
    log: logged(run, { floor: run.floor, kind: "skip", label: "Bỏ qua ban phước", detail: "+25 xu", hp: run.hp }),
  };
}

/** Nhận lời nguyền để đổi lấy xu (và về sau là di vật hiếm hơn). */
export function takeCurse(run: TowerRun, accept: boolean): TowerRun {
  if (!run.curseOffer) return run;
  if (!accept) {
    return {
      ...run,
      curseOffer: null,
      log: logged(run, { floor: run.floor, kind: "curse", label: "Từ chối lời nguyền", hp: run.hp }),
    };
  }
  const taken = run.curseOffer;
  return {
    ...run,
    curses: [...run.curses, taken.curseId],
    coins: run.coins + taken.coins,
    curseOffer: null,
    log: logged(run, {
      floor: run.floor,
      kind: "curse",
      label: `Gánh lời nguyền ${taken.curseId}`,
      detail: `+${taken.coins} xu`,
      hp: run.hp,
    }),
  };
}

/** Lửa trại: hồi máu hoặc nâng cấp một di vật (nhân đôi hiệu ứng cộng thẳng). */
export function restAtCampfire(run: TowerRun, choice: "heal" | "upgrade"): TowerRun {
  const mods = runModifiers(run);
  const asc = ascensionMods(run.ascension);
  let next = { ...run };
  const bonusPct = run.challenge?.correct ? 0.1 : 0; // Trả lời đúng câu ôn bài thì hồi thêm 10% máu tối đa.
  if (choice === "heal" && !mods.noHeal) {
    next.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * (asc.campfireHealPct + bonusPct)));
  } else {
    next.shield = run.shield + 15 + (run.challenge?.correct ? 5 : 0);
  }
  next.log = logged(run, {
    floor: run.floor,
    kind: "campfire",
    label: choice === "heal" && !mods.noHeal ? "Lửa trại — hồi máu" : "Lửa trại — rèn khiên",
    hp: next.hp,
  });
  next = advanceNonCombat(next);
  return next;
}

/** Sự kiện văn bản — sinh từ hạt nên mọi người cùng gặp cùng một tình huống. */
export type TowerEvent = {
  id: string;
  icon: string;
  title: string;
  text: string;
  choices: { id: string; label: string; hint: string }[];
};

export const EVENTS: TowerEvent[] = [
  {
    id: "ruong-bay",
    icon: "🧰",
    title: "Rương bẫy trong phòng thiết bị",
    text: "Một rương đồ nghề cũ không rõ của ai. Mở ra có thể trúng xu, cũng có thể dính bụi bẩn.",
    choices: [
      { id: "open", label: "Mở rương", hint: "50% được 80 xu, 50% mất 10 máu" },
      { id: "leave", label: "Đi tiếp", hint: "An toàn tuyệt đối" },
    ],
  },
  {
    id: "hien-mau",
    icon: "🩸",
    title: "Đổi sức lấy tri thức",
    text: "Một huấn luyện viên già đề nghị dạy bạn một mẹo nghề, đổi lại là một buổi trực đêm.",
    choices: [
      { id: "trade", label: "Nhận lời", hint: "−15 máu, +60 xu" },
      { id: "leave", label: "Từ chối", hint: "Không mất gì" },
    ],
  },
  {
    id: "cau-do",
    icon: "🧩",
    title: "Câu đố của đài chỉ huy",
    text: "Bảng điện tử nhấp nháy một dãy ký hiệu. Đoán đúng thì được thưởng.",
    choices: [
      { id: "guess", label: "Thử đoán", hint: "50% +khiên 20, 50% mất 20 xu" },
      { id: "leave", label: "Bỏ qua", hint: "Giữ nguyên hiện trạng" },
    ],
  },
];

export function eventAt(run: TowerRun): TowerEvent {
  const rand = branch(run.seed, `event-${run.floor}`);
  return EVENTS[Math.floor(rand() * EVENTS.length) % EVENTS.length]!;
}

export function resolveEvent(run: TowerRun, choiceId: string): { run: TowerRun; message: string } {
  const ev = eventAt(run);
  const rand = branch(run.seed, `event-roll-${run.floor}`);
  // Trả lời đúng câu thử thách sự kiện thì mọi lựa chọn rủi ro đều thành công.
  const lucky = run.challenge?.correct ? true : rand() < 0.5;
  let next = { ...run };
  let message = "Bạn đi tiếp, không có gì xảy ra.";

  if (choiceId !== "leave") {
    if (ev.id === "ruong-bay") {
      if (lucky) {
        next.coins += 80;
        message = "Rương đầy xu lẻ — bạn nhặt được 80 xu.";
      } else {
        next.hp = Math.max(1, next.hp - 10);
        message = "Nắp rương bật vào tay — bạn mất 10 máu.";
      }
    } else if (ev.id === "hien-mau") {
      next.hp = Math.max(1, next.hp - 15);
      next.coins += 60;
      message = "Một đêm trực đổi lấy mẹo nghề: −15 máu, +60 xu.";
    } else {
      if (lucky) {
        next.shield += 20;
        message = "Đoán trúng! Bạn nhận khiên 20 máu.";
      } else {
        next.coins = Math.max(0, next.coins - 20);
        message = "Đoán trượt, mất 20 xu tiền cược.";
      }
    }
  }
  next = advanceNonCombat(next);
  next.log = logged(run, { floor: run.floor, kind: "event", label: `Sự kiện: ${ev.title}`, detail: message, hp: next.hp });
  return { run: next, message };
}

/** Hàng hoá cửa hàng, sinh theo hạt của tầng. */
export function shopStock(run: TowerRun): { relics: Relic[]; healCost: number; cleanseCost: number } {
  const asc = ascensionMods(run.ascension);
  const rand = branch(run.seed, `shop-${run.floor}`);
  // Mặc cả thành công (đúng câu thử thách cửa hàng) thì giảm 30% mọi giá.
  const scale = (1 + asc.shopCostPct) * (run.challenge?.correct ? 0.7 : 1);
  return {
    relics: offerRelics(rand, run.relics, "thuong", 2),
    healCost: Math.round(60 * scale),
    cleanseCost: Math.round(120 * scale),
  };
}

export function buyAtShop(
  run: TowerRun,
  action: { kind: "relic"; relicId: string } | { kind: "heal" } | { kind: "cleanse"; curseId: string },
): { run: TowerRun; message: string } {
  const stock = shopStock(run);
  const mods = runModifiers(run);
  const discount = run.challenge?.correct ? 0.7 : 1;
  const price = (rarity: string) =>
    Math.round((rarity === "huyenthoai" ? 400 : rarity === "suthi" ? 260 : rarity === "hiem" ? 170 : 100) * discount);

  if (action.kind === "relic") {
    const relic = stock.relics.find((r) => r.id === action.relicId);
    if (!relic) return { run, message: "Món này đã bán hết." };
    const cost = price(relic.rarity);
    if (run.coins < cost) return { run, message: "Không đủ xu." };
    return {
      run: {
        ...run,
        coins: run.coins - cost,
        relics: [...run.relics, relic.id],
        hp: Math.min(run.maxHp, run.hp + (mods.noHeal ? 0 : (relic.effect.heal ?? 0))),
        shield: run.shield + (relic.effect.shield ?? 0),
      },
      message: `Đã mua ${relic.name}.`,
    };
  }
  if (action.kind === "heal") {
    if (run.coins < stock.healCost) return { run, message: "Không đủ xu." };
    if (mods.noHeal) return { run, message: "Hồi máu đang bị vô hiệu." };
    return {
      run: { ...run, coins: run.coins - stock.healCost, hp: Math.min(run.maxHp, run.hp + 30) },
      message: "Hồi 30 máu.",
    };
  }
  if (run.coins < stock.cleanseCost) return { run, message: "Không đủ xu." };
  if (!run.curses.includes(action.curseId)) return { run, message: "Bạn không mang lời nguyền này." };
  return {
    run: { ...run, coins: run.coins - stock.cleanseCost, curses: run.curses.filter((c) => c !== action.curseId) },
    message: "Đã gỡ lời nguyền.",
  };
}

export function leaveRoom(run: TowerRun): TowerRun {
  return advanceNonCombat(run);
}

/** Rời phòng không giao tranh: lên tầng và mở ban phước nhẹ. */
function advanceNonCombat(run: TowerRun): TowerRun {
  const nextFloor = run.floor + 1;
  const finished = nextFloor > FLOORS;
  const next: TowerRun = {
    ...run,
    floor: nextFloor,
    room: null,
    slots: [],
    challenge: null,
    finished,
    win: finished,
  };
  next.score = runScore({
    floorsCleared: Math.max(0, next.floor - 1),
    hp: next.hp,
    relics: next.relics,
    curses: next.curses,
    ascension: next.ascension,
  });
  return next;
}

/** Các nút có thể đi tới ở tầng hiện tại (đã lọc theo lối đi của bản đồ phân nhánh). */
export function floorChoices(run: TowerRun): { index: number; room: MapNode }[] {
  const row = run.map[run.floor - 1] ?? [];
  const from = run.floor <= 1 ? null : ((run.trail ?? [])[run.floor - 2] ?? null);
  return reachableAt(run.map, run.floor, from)
    .map((index) => ({ index, room: row[index]! }))
    .filter((x) => Boolean(x.room));
}

/** Danh sách phòng để chọn ở tầng hiện tại. */
export function floorOptions(run: TowerRun): Room[] {
  return floorChoices(run).map((c) => c.room);
}

export const floorIsBoss = (run: TowerRun) => isBossFloor(run.floor);
