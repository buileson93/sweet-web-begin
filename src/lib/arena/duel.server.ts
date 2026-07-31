/**
 * Đấu trường 1vs1 — toàn bộ luật chơi chạy phía máy chủ (service role).
 * Trình duyệt chỉ gửi ý định; điểm số, thời gian và đáp án đúng đều do máy chủ quyết định.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logArenaAudit } from "@/lib/arena/audit.server";
import { broadcastDuel } from "@/lib/arena/broadcast.server";
import { buildRoundPayload } from "@/lib/arena/payload";
import {
  ANSWER_RATE_LIMIT_MS,
  ABANDON_LIMIT_PER_HOUR,
  RANKED_LOCK_HOURS,
  TECHNICAL_LOSS_RATIO,
  isRankedEligible,
  vnDayStart,
} from "@/lib/arena/rules";
import { decideWinner, eloDelta, roundPoints } from "@/lib/arena/scoring";
import { DUEL_COLUMNS, type DuelFinish, type DuelState, type RoundResult } from "@/lib/arena/types";
import { QUESTION_COLUMNS } from "@/lib/exam/types";
import {
  correctTextOf,
  gradeOne,
  pickByBlueprint,
  shuffle,
  type QuestionRow,
} from "@/lib/grading";
import type { Blueprint } from "@/lib/questionKinds";

/** Thời gian đếm ngược trước khi vào câu đầu tiên (ms). */
const COUNTDOWN_MS = 4_000;
/** Thời gian hiển thị đáp án giữa hai câu (ms). */
const REVEAL_MS = 3_000;
/** Độ trễ mạng được tha thứ khi gửi đáp án (ms). */
const NETWORK_GRACE_MS = 1_500;
/** Thời gian chờ đối thủ mất kết nối trước khi xử thua kỹ thuật (ms). */
export const DISCONNECT_GRACE_MS = 20_000;

type DuelRow = {
  id: string;
  quiz_id: string | null;
  status: string;
  round_count: number;
  seconds_per_round: number;
  is_ranked: boolean;
  current_round: number;
  round_served_at: string | null;
  question_ids: string[];
  option_orders: unknown;
  version: number;
  started_at: string | null;
  finished_at: string | null;
  winner_employee_id: string | null;
  note: string;
};

const nowIso = () => new Date().toISOString();

/** Tạo hồ sơ đấu thủ khi lần đầu bước vào đấu trường (tạo lười để tránh hàng nghìn dòng rác). */
export async function ensurePlayer(employeeId: string, displayName: string, unit: string) {
  const { data } = await supabaseAdmin
    .from("players")
    .select("*")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (data) {
    if (data.display_name !== displayName || data.unit !== unit) {
      await supabaseAdmin
        .from("players")
        .update({ display_name: displayName, unit, updated_at: nowIso() })
        .eq("employee_id", employeeId);
    }
    return { ...data, display_name: displayName, unit };
  }
  const { data: created, error } = await supabaseAdmin
    .from("players")
    .insert({ employee_id: employeeId, display_name: displayName, unit })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return created;
}

async function requireSettings() {
  const { data } = await supabaseAdmin.from("arena_settings").select("*").maybeSingle();
  if (data && data.enabled === false) throw new Error("Đấu trường đang tạm đóng để bảo trì.");
  return data ?? { enabled: true, default_rounds: 10, default_seconds: 20 };
}

async function loadDuel(duelId: string): Promise<DuelRow> {
  const { data } = await supabaseAdmin
    .from("duels")
    .select(DUEL_COLUMNS + ", last_result")
    .eq("id", duelId)
    .maybeSingle();
  if (!data) throw new Error("Không tìm thấy trận đấu.");
  return data as unknown as DuelRow;
}

async function loadPlayers(duelId: string) {
  const { data } = await supabaseAdmin
    .from("duel_players")
    .select("*")
    .eq("duel_id", duelId)
    .order("seat", { ascending: true });
  return data ?? [];
}

/** Bốc đề cho trận: dùng chung pickByBlueprint với kỳ thi để hai luồng không lệch nhau. */
async function pickDuelQuestions(quizId: string | null, count: number) {
  let query = supabaseAdmin
    .from("questions")
    .select(QUESTION_COLUMNS)
    .eq("is_archived", false)
    .limit(600);
  if (quizId) query = query.eq("quiz_id", quizId);
  const { data } = await query;
  const pool = (data ?? []) as unknown as QuestionRow[];
  if (pool.length < count)
    throw new Error(`Ngân hàng câu hỏi chỉ có ${pool.length} câu, cần tối thiểu ${count} câu.`);
  const picked = pickByBlueprint(pool, count, {} as Blueprint, true);
  const orders = picked.map((q) => {
    const n = Math.max(1, (q.options ?? []).length);
    return shuffle(Array.from({ length: n }, (_, i) => i));
  });
  return { ids: picked.map((q) => q.id), orders };
}

async function assertFree(employeeId: string) {
  const { data } = await supabaseAdmin
    .from("duel_players")
    .select("duel_id")
    .eq("employee_id", employeeId)
    .is("left_at", null)
    .in("duel_status", ["waiting", "countdown", "playing"])
    .maybeSingle();
  if (data)
    throw new Error("Bạn đang ở trong một trận khác. Hãy kết thúc hoặc rời trận đó trước.");
}

export async function createDuel(input: {
  employeeId: string;
  quizId?: string | null;
  roundCount?: number;
  secondsPerRound?: number;
  isRanked?: boolean;
  deviceHash?: string;
}): Promise<{ duelId: string }> {
  const settings = await requireSettings();
  const player = await mustPlayer(input.employeeId);
  if (player.blocked) throw new Error("Tài khoản của bạn đang bị tạm khoá thi đấu.");
  await assertFree(input.employeeId);

  const roundCount = Math.min(20, Math.max(3, input.roundCount ?? settings.default_rounds));
  const seconds = Math.min(60, Math.max(5, input.secondsPerRound ?? settings.default_seconds));
  const { ids, orders } = await pickDuelQuestions(input.quizId ?? null, roundCount);

  const { data: duel, error } = await supabaseAdmin
    .from("duels")
    .insert({
      quiz_id: input.quizId ?? null,
      status: "waiting",
      round_count: roundCount,
      seconds_per_round: seconds,
      is_ranked: input.isRanked !== false,
      question_ids: ids,
      option_orders: orders as never,
      created_by: input.employeeId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await joinDuel({ duelId: duel.id, employeeId: input.employeeId, deviceHash: input.deviceHash });
  await logArenaAudit("create", duel.id, `${player.display_name} tạo trận`, {
    roundCount,
    seconds,
  });
  return { duelId: duel.id };
}

async function mustPlayer(employeeId: string) {
  const { data } = await supabaseAdmin
    .from("players")
    .select("*")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (!data) throw new Error("Chưa có hồ sơ đấu thủ. Vui lòng vào lại Đấu trường.");
  return data;
}

export async function joinDuel(input: {
  duelId: string;
  employeeId: string;
  deviceHash?: string;
}) {
  const duel = await loadDuel(input.duelId);
  if (duel.status !== "waiting") throw new Error("Trận này đã bắt đầu hoặc đã kết thúc.");
  const players = await loadPlayers(duel.id);
  if (players.some((p) => p.employee_id === input.employeeId)) return { ok: true };
  if (players.length >= 2) throw new Error("Trận này đã đủ hai người.");
  await assertFree(input.employeeId);

  const player = await mustPlayer(input.employeeId);
  const { error } = await supabaseAdmin.from("duel_players").insert({
    duel_id: duel.id,
    employee_id: input.employeeId,
    seat: players.length,
    display_name: player.display_name,
    unit: player.unit,
    elo_before: player.elo,
    device_hash: (input.deviceHash ?? "").slice(0, 80),
  });
  if (error) {
    if (error.code === "23505")
      throw new Error("Bạn đang ở trong một trận khác. Hãy kết thúc hoặc rời trận đó trước.");
    throw new Error(error.message);
  }
  await bumpVersion(duel.id);
  await broadcastDuel(duel.id, "lobby.update", { duelId: duel.id });
  return { ok: true };
}

async function bumpVersion(duelId: string, patch: Record<string, unknown> = {}) {
  const { data } = await supabaseAdmin
    .from("duels")
    .select("version")
    .eq("id", duelId)
    .maybeSingle();
  await supabaseAdmin
    .from("duels")
    .update({ ...patch, version: (data?.version ?? 0) + 1 } as never)
    .eq("id", duelId);
}

/** Ghép nhanh: nới dần biên độ Elo theo thời gian chờ. */
export async function quickMatch(input: {
  employeeId: string;
  waitedSeconds?: number;
  deviceHash?: string;
}): Promise<{ duelId: string; created: boolean }> {
  await requireSettings();
  const player = await mustPlayer(input.employeeId);
  if (player.blocked) throw new Error("Tài khoản của bạn đang bị tạm khoá thi đấu.");

  const { data: mine } = await supabaseAdmin
    .from("duel_players")
    .select("duel_id")
    .eq("employee_id", input.employeeId)
    .is("left_at", null)
    .in("duel_status", ["waiting", "countdown", "playing"])
    .maybeSingle();
  if (mine) return { duelId: mine.duel_id, created: false };

  const waited = input.waitedSeconds ?? 0;
  const spread = waited >= 30 ? 100_000 : waited >= 15 ? 300 : 150;

  const { data: waitingRaw } = await supabaseAdmin
    .from("duels")
    .select("id, created_at, duel_players(employee_id, elo_before, left_at)")
    .eq("status", "waiting")
    .order("created_at", { ascending: true })
    .limit(20);

  for (const room of waitingRaw ?? []) {
    const seats = (room as { duel_players: { employee_id: string; elo_before: number; left_at: string | null }[] })
      .duel_players.filter((p) => !p.left_at);
    if (seats.length !== 1) continue;
    if (seats[0].employee_id === input.employeeId) continue;
    if (Math.abs(seats[0].elo_before - player.elo) > spread) continue;
    try {
      await joinDuel({ duelId: room.id, employeeId: input.employeeId, deviceHash: input.deviceHash });
      return { duelId: room.id, created: false };
    } catch {
      continue; // phòng vừa bị người khác chiếm — thử phòng tiếp theo
    }
  }

  const { duelId } = await createDuel({
    employeeId: input.employeeId,
    deviceHash: input.deviceHash,
  });
  return { duelId, created: true };
}

export async function inviteToDuel(input: {
  employeeId: string;
  toEmployeeId: string;
  duelId?: string;
  deviceHash?: string;
}) {
  await requireSettings();
  const player = await mustPlayer(input.employeeId);
  if (input.toEmployeeId === input.employeeId) throw new Error("Không thể tự thách đấu chính mình.");

  let duelId = input.duelId;
  if (!duelId) {
    const { data: mine } = await supabaseAdmin
      .from("duel_players")
      .select("duel_id, duel_status")
      .eq("employee_id", input.employeeId)
      .is("left_at", null)
      .in("duel_status", ["waiting"])
      .maybeSingle();
    duelId =
      mine?.duel_id ??
      (await createDuel({ employeeId: input.employeeId, deviceHash: input.deviceHash })).duelId;
  }

  await supabaseAdmin
    .from("duel_invites")
    .update({ status: "expired" })
    .eq("from_employee_id", input.employeeId)
    .eq("to_employee_id", input.toEmployeeId)
    .eq("status", "pending");

  const { data, error } = await supabaseAdmin
    .from("duel_invites")
    .insert({
      duel_id: duelId,
      from_employee_id: input.employeeId,
      to_employee_id: input.toEmployeeId,
      from_name: player.display_name,
      expires_at: new Date(Date.now() + 120_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { inviteId: data.id, duelId };
}

export async function respondInvite(input: {
  employeeId: string;
  inviteId: string;
  accept: boolean;
  deviceHash?: string;
}) {
  const { data: invite } = await supabaseAdmin
    .from("duel_invites")
    .select("*")
    .eq("id", input.inviteId)
    .maybeSingle();
  if (!invite || invite.to_employee_id !== input.employeeId)
    throw new Error("Lời mời không tồn tại.");
  if (invite.status !== "pending") throw new Error("Lời mời đã được xử lý.");
  if (Date.parse(invite.expires_at) < Date.now()) {
    await supabaseAdmin.from("duel_invites").update({ status: "expired" }).eq("id", invite.id);
    throw new Error("Lời mời đã hết hạn.");
  }

  if (!input.accept) {
    await supabaseAdmin.from("duel_invites").update({ status: "declined" }).eq("id", invite.id);
    await broadcastDuel(invite.duel_id, "lobby.update", { declined: true });
    return { ok: true, duelId: null as string | null };
  }

  await joinDuel({
    duelId: invite.duel_id,
    employeeId: input.employeeId,
    deviceHash: input.deviceHash,
  });
  await supabaseAdmin.from("duel_invites").update({ status: "accepted" }).eq("id", invite.id);
  return { ok: true, duelId: invite.duel_id as string | null };
}

export async function setReady(input: { employeeId: string; duelId: string }) {
  const duel = await loadDuel(input.duelId);
  if (duel.status !== "waiting") return { ok: true };
  await supabaseAdmin
    .from("duel_players")
    .update({ ready: true })
    .eq("duel_id", duel.id)
    .eq("employee_id", input.employeeId);

  const players = await loadPlayers(duel.id);
  if (players.length === 2 && players.every((p) => p.ready && !p.left_at)) {
    const startAt = new Date(Date.now() + COUNTDOWN_MS).toISOString();
    // Chống thông đồng: cùng thiết bị thì trận chỉ để giải trí.
    const sameDevice =
      !!players[0].device_hash && players[0].device_hash === players[1].device_hash;
    const ranked = await resolveRanked(duel, players, sameDevice);
    await supabaseAdmin
      .from("duels")
      .update({
        status: "countdown",
        started_at: startAt,
        is_ranked: duel.is_ranked && ranked.ranked,
        note: ranked.reason,
        version: duel.version + 1,
      })
      .eq("id", duel.id);
    if (!ranked.ranked && duel.is_ranked)
      await logArenaAudit("update", duel.id, "Trận chuyển sang đấu vui", { reason: ranked.reason });
    await broadcastDuel(duel.id, "duel.countdown", { startAt, duelId: duel.id });
  } else {
    await bumpVersion(duel.id);
    await broadcastDuel(duel.id, "lobby.update", { duelId: duel.id });
  }
  return { ok: true };
}

async function resolveRanked(
  duel: DuelRow,
  players: { employee_id: string; device_hash: string }[],
  sameDevice: boolean,
) {
  const me = await mustPlayer(players[0].employee_id);
  const dayStart = vnDayStart(Date.now());
  const { count } = await supabaseAdmin
    .from("duels")
    .select("id", { count: "exact", head: true })
    .eq("is_ranked", true)
    .eq("status", "finished")
    .gte("created_at", dayStart);

  const { data: recent } = await supabaseAdmin
    .from("duel_players")
    .select("duel_id, employee_id")
    .in(
      "duel_id",
      (
        await supabaseAdmin
          .from("duel_players")
          .select("duel_id")
          .eq("employee_id", players[0].employee_id)
          .order("joined_at", { ascending: false })
          .limit(5)
      ).data?.map((d) => d.duel_id) ?? ["00000000-0000-0000-0000-000000000000"],
    );
  const opponentId = players[1].employee_id;
  const sameOpponentStreak = new Set(
    (recent ?? []).filter((r) => r.employee_id === opponentId).map((r) => r.duel_id),
  ).size;

  return isRankedEligible({
    rankedToday: count ?? 0,
    sameOpponentStreak,
    lockedUntil: me.ranked_locked_until,
    sameDevice,
    nowMs: Date.now(),
  });
}

/** Phát một câu hỏi ra kênh trận đấu. */
async function serveRound(duel: DuelRow, roundIndex: number, delayMs = 0) {
  const servedAt = new Date(Date.now() + delayMs).toISOString();
  await supabaseAdmin
    .from("duels")
    .update({
      status: "playing",
      current_round: roundIndex,
      round_served_at: servedAt,
      version: duel.version + 1,
    })
    .eq("id", duel.id);

  const row = await questionAt(duel, roundIndex);
  if (!row) return;
  const payload = buildRoundPayload(row.row, row.order, roundIndex);
  await broadcastDuel(duel.id, "round.start", {
    duelId: duel.id,
    servedAt,
    seconds: duel.seconds_per_round,
    question: payload,
  });
}

async function questionAt(duel: DuelRow, index: number) {
  const qid = duel.question_ids?.[index];
  if (!qid) return null;
  const { data } = await supabaseAdmin
    .from("questions")
    .select(QUESTION_COLUMNS)
    .eq("id", qid)
    .maybeSingle();
  if (!data) return null;
  const orders = (duel.option_orders as number[][]) ?? [];
  return { row: data as unknown as QuestionRow, order: orders[index] ?? [] };
}

const lastAnswerAt = new Map<string, number>();

export async function answerRound(input: {
  employeeId: string;
  duelId: string;
  roundIndex: number;
  value: unknown;
}) {
  // Chống spam: tối đa 1 yêu cầu / 300ms cho mỗi người.
  const key = `${input.employeeId}:${input.duelId}`;
  const last = lastAnswerAt.get(key) ?? 0;
  if (Date.now() - last < ANSWER_RATE_LIMIT_MS) throw new Error("Bạn thao tác quá nhanh.");
  lastAnswerAt.set(key, Date.now());

  const duel = await loadDuel(input.duelId);
  if (duel.status !== "playing") throw new Error("Trận chưa bắt đầu hoặc đã kết thúc.");
  if (input.roundIndex !== duel.current_round) throw new Error("Câu hỏi đã chuyển, đáp án không hợp lệ.");

  const servedAt = duel.round_served_at ? Date.parse(duel.round_served_at) : Date.now();
  const now = Date.now();
  if (now < servedAt) throw new Error("Câu hỏi chưa bắt đầu.");
  if (now > servedAt + duel.seconds_per_round * 1000 + NETWORK_GRACE_MS)
    throw new Error("Đã hết giờ trả lời câu này.");

  const q = await questionAt(duel, input.roundIndex);
  if (!q) throw new Error("Không tìm thấy câu hỏi.");

  const isCorrect = gradeOne(q.row, q.order, input.value as never);
  const msTaken = Math.max(0, Math.min(now - servedAt, duel.seconds_per_round * 1000));
  const streak = await currentStreak(duel.id, input.employeeId, input.roundIndex, isCorrect);
  const points = roundPoints(isCorrect, msTaken, duel.seconds_per_round * 1000, streak);

  // Unique(duel, employee, round) là chốt chặn cuối: hai request song song chỉ ghi được một.
  const { error } = await supabaseAdmin.from("duel_answers").insert({
    duel_id: duel.id,
    employee_id: input.employeeId,
    round_index: input.roundIndex,
    value: (input.value ?? null) as never,
    is_correct: isCorrect,
    ms_taken: msTaken,
    points,
  });
  if (error) {
    if (error.code === "23505") throw new Error("Bạn đã trả lời câu này rồi.");
    throw new Error(error.message);
  }

  const players = await loadPlayers(duel.id);
  const me = players.find((p) => p.employee_id === input.employeeId);
  if (me) {
    await supabaseAdmin
      .from("duel_players")
      .update({
        score: me.score + points,
        correct: me.correct + (isCorrect ? 1 : 0),
        total_ms: me.total_ms + msTaken,
      })
      .eq("id", me.id);
  }

  await broadcastDuel(duel.id, "round.opponent_answered", {
    roundIndex: input.roundIndex,
    employeeId: input.employeeId,
  });

  const { count } = await supabaseAdmin
    .from("duel_answers")
    .select("id", { count: "exact", head: true })
    .eq("duel_id", duel.id)
    .eq("round_index", input.roundIndex);
  const active = players.filter((p) => !p.left_at).length;
  if ((count ?? 0) >= active) await closeRound(duel.id, input.roundIndex);

  return { accepted: true, points, isCorrect };
}

async function currentStreak(
  duelId: string,
  employeeId: string,
  roundIndex: number,
  isCorrect: boolean,
) {
  if (!isCorrect) return 0;
  const { data } = await supabaseAdmin
    .from("duel_answers")
    .select("round_index, is_correct")
    .eq("duel_id", duelId)
    .eq("employee_id", employeeId)
    .order("round_index", { ascending: false })
    .limit(10);
  let streak = 1;
  let expect = roundIndex - 1;
  for (const row of data ?? []) {
    if (row.round_index !== expect || !row.is_correct) break;
    streak++;
    expect--;
  }
  return streak;
}

/** Chốt một câu: công bố đáp án, cộng điểm, hẹn giờ sang câu tiếp. */
export async function closeRound(duelId: string, roundIndex: number) {
  const duel = await loadDuel(duelId);
  if (duel.status !== "playing" || duel.current_round !== roundIndex) return;

  const q = await questionAt(duel, roundIndex);
  const players = await loadPlayers(duelId);
  const { data: answers } = await supabaseAdmin
    .from("duel_answers")
    .select("employee_id, is_correct, ms_taken, points")
    .eq("duel_id", duelId)
    .eq("round_index", roundIndex);

  const result: RoundResult = {
    roundIndex,
    correctText: q ? correctTextOf(q.row) : "",
    explanation: q?.row.explanation ?? "",
    lines: players.map((p) => {
      const a = (answers ?? []).find((x) => x.employee_id === p.employee_id);
      return {
        employeeId: p.employee_id,
        isCorrect: a?.is_correct ?? false,
        msTaken: a?.ms_taken ?? 0,
        points: a?.points ?? 0,
        score: p.score,
      };
    }),
  };

  const isLast = roundIndex + 1 >= duel.round_count;
  await supabaseAdmin
    .from("duels")
    .update({ last_result: result as never, version: duel.version + 1 })
    .eq("id", duelId);
  await broadcastDuel(duelId, "round.result", result);

  if (isLast) {
    // Chờ đúng thời gian hiện đáp án rồi chốt trận; nếu tiến trình bị cắt,
    // watchdog (tickDuels) vẫn kết thúc trận này.
    await new Promise((r) => setTimeout(r, REVEAL_MS));
    await finishDuel(duelId);
  } else {
    const next = await loadDuel(duelId);
    await serveRound(next, roundIndex + 1, REVEAL_MS);
  }
}


/** Hết đếm ngược: chuyển sang thi đấu và phát câu đầu tiên. */
export async function startPlaying(duelId: string) {
  const duel = await loadDuel(duelId);
  if (duel.status !== "countdown") return;
  await serveRound(duel, 0, 0);
}

export async function leaveDuel(input: { employeeId: string; duelId: string }) {

  const duel = await loadDuel(input.duelId);
  await supabaseAdmin
    .from("duel_players")
    .update({ left_at: nowIso() })
    .eq("duel_id", duel.id)
    .eq("employee_id", input.employeeId)
    .is("left_at", null);
  await bumpVersion(duel.id);
  await broadcastDuel(duel.id, "player.left", {
    employeeId: input.employeeId,
    graceMs: DISCONNECT_GRACE_MS,
  });

  if (duel.status === "waiting" || duel.status === "countdown") {
    const players = await loadPlayers(duel.id);
    if (players.every((p) => p.left_at))
      await supabaseAdmin
        .from("duels")
        .update({ status: "cancelled", finished_at: nowIso() })
        .eq("id", duel.id);
  }
  return { ok: true };
}

/** Kết thúc trận: tính Elo, cập nhật hồ sơ, trao huy hiệu, ghi nhật ký. */
export async function finishDuel(duelId: string, technicalLoserId?: string) {
  const duel = await loadDuel(duelId);
  if (duel.status === "finished" || duel.status === "cancelled") return;

  const players = await loadPlayers(duelId);
  if (players.length < 2) {
    await supabaseAdmin
      .from("duels")
      .update({ status: "cancelled", finished_at: nowIso() })
      .eq("id", duelId);
    return;
  }

  const lines = players.map((p) => ({
    employeeId: p.employee_id,
    score: p.score,
    correct: p.correct,
    totalMs: p.total_ms,
  }));
  let decision = decideWinner(lines);
  if (technicalLoserId) {
    const winner = players.find((p) => p.employee_id !== technicalLoserId);
    decision = { winnerId: winner?.employee_id ?? null, reason: "score" };
  }

  const profiles = await Promise.all(players.map((p) => mustPlayer(p.employee_id)));
  const finishLines: DuelFinish["lines"] = [];

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const me = profiles[i];
    const opp = profiles[1 - i];
    const isWinner = decision.winnerId === p.employee_id;
    const isDraw = decision.winnerId === null;
    const result: 1 | 0.5 | 0 = isDraw ? 0.5 : isWinner ? 1 : 0;

    let delta = duel.is_ranked ? eloDelta(me.elo, opp.elo, result, me.games) : 0;
    // Xử thua kỹ thuật: chỉ trừ 60% mức bình thường.
    if (technicalLoserId === p.employee_id && delta < 0)
      delta = Math.round(delta * TECHNICAL_LOSS_RATIO);

    const coins = isDraw ? 10 : isWinner ? 20 : 5;
    const eloAfter = me.elo + delta;
    const streak = isWinner ? me.streak + 1 : 0;

    await supabaseAdmin
      .from("players")
      .update({
        elo: eloAfter,
        games: me.games + 1,
        wins: me.wins + (isWinner ? 1 : 0),
        losses: me.losses + (!isWinner && !isDraw ? 1 : 0),
        draws: me.draws + (isDraw ? 1 : 0),
        streak,
        best_streak: Math.max(me.best_streak, streak),
        coins: me.coins + coins,
        abandons: me.abandons + (technicalLoserId === p.employee_id ? 1 : 0),
        updated_at: nowIso(),
      })
      .eq("employee_id", p.employee_id);

    await supabaseAdmin
      .from("duel_players")
      .update({ elo_after: eloAfter })
      .eq("id", p.id);

    const newBadges = await grantBadges({
      employeeId: p.employee_id,
      games: me.games + 1,
      wins: me.wins + (isWinner ? 1 : 0),
      streak,
      isWinner,
      eloGap: opp.elo - me.elo,
      correct: p.correct,
      roundCount: duel.round_count,
      duelId,
    });

    finishLines.push({
      employeeId: p.employee_id,
      displayName: p.display_name,
      score: p.score,
      correct: p.correct,
      eloBefore: me.elo,
      eloAfter,
      coins,
      newBadges,
    });

    if (technicalLoserId === p.employee_id) await applyAbandonPenalty(p.employee_id);
  }

  const finish: DuelFinish = {
    winnerEmployeeId: decision.winnerId,
    reason: decision.reason,
    isRanked: duel.is_ranked,
    rankedNote: duel.note ?? "",
    lines: finishLines,
  };

  await supabaseAdmin
    .from("duels")
    .update({
      status: "finished",
      finished_at: nowIso(),
      winner_employee_id: decision.winnerId,
      last_result: { ...(finish as never as object), kind: "finish" } as never,
      version: duel.version + 2,
    })
    .eq("id", duelId);

  await broadcastDuel(duelId, "duel.finish", finish);
  await logArenaAudit(
    technicalLoserId ? "update" : "update",
    duelId,
    technicalLoserId ? "Xử thua kỹ thuật" : "Kết thúc trận",
    { winner: decision.winnerId, ranked: duel.is_ranked },
  );
}

async function applyAbandonPenalty(employeeId: string) {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await supabaseAdmin
    .from("duel_players")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", employeeId)
    .gte("joined_at", since)
    .not("left_at", "is", null);
  if ((count ?? 0) >= ABANDON_LIMIT_PER_HOUR) {
    await supabaseAdmin
      .from("players")
      .update({
        ranked_locked_until: new Date(Date.now() + RANKED_LOCK_HOURS * 3_600_000).toISOString(),
      })
      .eq("employee_id", employeeId);
  }
}

async function grantBadges(input: {
  employeeId: string;
  games: number;
  wins: number;
  streak: number;
  isWinner: boolean;
  eloGap: number;
  correct: number;
  roundCount: number;
  duelId: string;
}) {
  const codes: string[] = [];
  if (input.games === 1) codes.push("first_duel");
  if (input.wins >= 10) codes.push("win_10");
  if (input.streak >= 5) codes.push("streak_5");
  if (input.isWinner && input.eloGap >= 200) codes.push("giant_slayer");
  if (input.correct >= input.roundCount && input.roundCount >= 10) codes.push("flawless");
  if (input.games >= 100) codes.push("games_100");

  const { count: fast } = await supabaseAdmin
    .from("duel_answers")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", input.employeeId)
    .eq("is_correct", true)
    .lt("ms_taken", 3000);
  if ((fast ?? 0) >= 5) codes.push("fast_5");

  if (!codes.length) return [];
  await supabaseAdmin
    .from("player_badges")
    .upsert(
      codes.map((code) => ({ employee_id: input.employeeId, badge_code: code })),
      { onConflict: "employee_id,badge_code", ignoreDuplicates: true },
    );
  const { data } = await supabaseAdmin
    .from("badges")
    .select("code, name, icon")
    .in("code", codes);
  return data ?? [];
}

/** Trạng thái đầy đủ của trận — dùng cho lần vào đầu và cho cơ chế hỏi lại khi mất WebSocket. */
export async function getDuelState(input: {
  employeeId: string;
  duelId: string;
}): Promise<DuelState> {
  const duel = await loadDuel(input.duelId);
  const players = await loadPlayers(duel.id);
  if (!players.some((p) => p.employee_id === input.employeeId))
    throw new Error("Bạn không thuộc trận đấu này.");

  const { data: answers } = await supabaseAdmin
    .from("duel_answers")
    .select("employee_id, round_index")
    .eq("duel_id", duel.id)
    .eq("round_index", duel.current_round);

  const profiles = await supabaseAdmin
    .from("players")
    .select("employee_id, elo, avatar")
    .in("employee_id", players.map((p) => p.employee_id));

  let question = null;
  if (duel.status === "playing") {
    const q = await questionAt(duel, duel.current_round);
    if (q) question = buildRoundPayload(q.row, q.order, duel.current_round);
  }

  let quizTitle = "Câu hỏi tổng hợp";
  if (duel.quiz_id) {
    const { data } = await supabaseAdmin
      .from("quizzes")
      .select("title")
      .eq("id", duel.quiz_id)
      .maybeSingle();
    quizTitle = data?.title ?? quizTitle;
  }

  const raw = (duel as unknown as { last_result: unknown }).last_result as
    | (RoundResult & { kind?: string })
    | null;

  return {
    duelId: duel.id,
    you: input.employeeId,
    status: duel.status as DuelState["status"],
    version: duel.version,
    roundCount: duel.round_count,
    secondsPerRound: duel.seconds_per_round,
    isRanked: duel.is_ranked,
    currentRound: duel.current_round,
    roundServedAt: duel.round_served_at,
    startedAt: duel.started_at,
    serverNow: nowIso(),
    quizTitle,
    players: players.map((p) => {
      const prof = (profiles.data ?? []).find((x) => x.employee_id === p.employee_id);
      return {
        employeeId: p.employee_id,
        displayName: p.display_name,
        unit: p.unit,
        seat: p.seat,
        elo: prof?.elo ?? p.elo_before,
        score: p.score,
        correct: p.correct,
        ready: p.ready,
        left: !!p.left_at,
        answered: (answers ?? []).some((a) => a.employee_id === p.employee_id),
        avatar: prof?.avatar ?? "",
      };
    }),
    question,
    lastResult: raw && raw.kind !== "finish" ? (raw as RoundResult) : null,
    finish:
      duel.status === "finished" && raw && raw.kind === "finish"
        ? (raw as unknown as DuelFinish)
        : null,
  };
}
