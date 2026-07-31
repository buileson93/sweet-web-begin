/**
 * Thống kê cá nhân và xem lại ván so tài.
 * Chỉ trả về dữ liệu hiển thị; đáp án đúng chỉ lộ ra với ván ĐÃ KẾT THÚC.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { HP_START } from "@/lib/arena/combat";
import { eloTier } from "@/lib/arena/scoring";
import { correctTextOf, type QuestionRow } from "@/lib/grading";
import { QUESTION_COLUMNS } from "@/lib/exam/types";

export type EloPoint = {
  duelId: string;
  at: string;
  opponent: string;
  elo: number;
  delta: number;
  result: "win" | "loss" | "draw";
  hp: number;
  damageDealt: number;
  isRanked: boolean;
};

export type PlayerStats = {
  displayName: string;
  unit: string;
  elo: number;
  peakElo: number;
  tier: { key: string; label: string; icon: string };
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  avgDamage: number;
  timeline: EloPoint[];
  /** Chuỗi kết quả gần nhất (mới nhất ở cuối). */
  form: ("win" | "loss" | "draw")[];
};

/** Biến động Elo, chuỗi thắng thua và lịch sử so tài theo thời gian. */
export async function getPlayerStats(employeeId: string, limit = 40): Promise<PlayerStats> {
  const { data: player } = await supabaseAdmin
    .from("players")
    .select("*")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (!player) throw new Error("Chưa có hồ sơ đấu thủ.");

  const { data: mine } = await supabaseAdmin
    .from("duel_players")
    .select("duel_id, hp, damage_dealt, correct, elo_before, elo_after, joined_at")
    .eq("employee_id", employeeId)
    .not("elo_after", "is", null)
    .order("joined_at", { ascending: false })
    .limit(Math.min(100, limit));

  const rows = [...(mine ?? [])].reverse();
  const ids = rows.map((r) => r.duel_id);

  let opponents: { duel_id: string; employee_id: string; display_name: string }[] = [];
  let duels: { id: string; finished_at: string | null; winner_employee_id: string | null; is_ranked: boolean }[] = [];
  if (ids.length) {
    const [oppRes, duelRes] = await Promise.all([
      supabaseAdmin.from("duel_players").select("duel_id, employee_id, display_name").in("duel_id", ids),
      supabaseAdmin.from("duels").select("id, finished_at, winner_employee_id, is_ranked").in("id", ids),
    ]);
    opponents = (oppRes.data ?? []).filter((o) => o.employee_id !== employeeId);
    duels = duelRes.data ?? [];
  }

  const timeline: EloPoint[] = rows.map((r) => {
    const duel = duels.find((d) => d.id === r.duel_id);
    const opp = opponents.find((o) => o.duel_id === r.duel_id);
    const result: EloPoint["result"] =
      duel?.winner_employee_id === employeeId
        ? "win"
        : duel?.winner_employee_id === null
          ? "draw"
          : "loss";
    return {
      duelId: r.duel_id,
      at: duel?.finished_at ?? r.joined_at,
      opponent: opp?.display_name ?? "Đối thủ",
      elo: r.elo_after ?? r.elo_before,
      delta: (r.elo_after ?? r.elo_before) - r.elo_before,
      result,
      hp: r.hp ?? HP_START,
      damageDealt: r.damage_dealt ?? 0,
      isRanked: duel?.is_ranked ?? false,
    };
  });

  const peakElo = timeline.reduce((max, p) => Math.max(max, p.elo), player.elo);
  const totalDamage = rows.reduce((sum, r) => sum + (r.damage_dealt ?? 0), 0);
  const total = player.wins + player.losses + player.draws;

  return {
    displayName: player.display_name,
    unit: player.unit || "Chưa cập nhật",
    elo: player.elo,
    peakElo,
    tier: eloTier(player.elo),
    games: player.games,
    wins: player.wins,
    losses: player.losses,
    draws: player.draws,
    winRate: total ? Math.round((player.wins / total) * 100) : 0,
    currentStreak: player.streak,
    bestStreak: player.best_streak,
    avgDamage: rows.length ? Math.round(totalDamage / rows.length) : 0,
    timeline,
    form: timeline.slice(-10).map((p) => p.result),
  };
}

export type ReplayRound = {
  index: number;
  question: string;
  correctText: string;
  explanation: string;
  neutral: boolean;
  lines: {
    employeeId: string;
    displayName: string;
    answered: boolean;
    isCorrect: boolean;
    msTaken: number;
    damage: number;
    firstCorrect: boolean;
    hpAfter: number;
  }[];
};

export type DuelReplay = {
  duelId: string;
  finishedAt: string | null;
  isRanked: boolean;
  roundCount: number;
  hpStart: number;
  quizTitle: string;
  winnerEmployeeId: string | null;
  players: {
    employeeId: string;
    displayName: string;
    unit: string;
    hp: number;
    damageDealt: number;
    correct: number;
    score: number;
    eloBefore: number;
    eloAfter: number | null;
    avatarUrl: string;
    avatarImage: string;
    level: number;
  }[];
  rounds: ReplayRound[];
};

/** Diễn biến chi tiết của một ván so tài đã kết thúc. */
export async function getDuelReplay(duelId: string): Promise<DuelReplay> {
  const { data: duel } = await supabaseAdmin
    .from("duels")
    .select(
      "id, quiz_id, status, round_count, hp_start, is_ranked, finished_at, winner_employee_id, question_ids",
    )
    .eq("id", duelId)
    .maybeSingle();
  if (!duel) throw new Error("Không tìm thấy ván so tài.");
  if (duel.status !== "finished")
    throw new Error("Ván so tài chưa kết thúc nên chưa xem lại được.");

  const { data: players } = await supabaseAdmin
    .from("duel_players")
    .select("employee_id, display_name, unit, hp, damage_dealt, correct, score, elo_before, elo_after")
    .eq("duel_id", duelId)
    .order("seat", { ascending: true });
  const seats = players ?? [];
  const ids = seats.map((p) => p.employee_id);

  const [{ data: answers }, { data: profiles }, { data: questions }] = await Promise.all([
    supabaseAdmin
      .from("duel_answers")
      .select("employee_id, round_index, is_correct, ms_taken, damage, first_correct, skill")
      .eq("duel_id", duelId)
      .order("round_index", { ascending: true }),
    supabaseAdmin
      .from("player_profiles")
      .select("employee_id, xp, avatar_url, avatar_image")
      .in("employee_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    supabaseAdmin
      .from("questions")
      .select(QUESTION_COLUMNS)
      .in("id", (duel.question_ids ?? []).slice(0, duel.round_count)),
  ]);

  const { levelProgress } = await import("@/lib/xp");
  const qRows = (questions ?? []) as unknown as QuestionRow[];
  const hpStart = duel.hp_start ?? HP_START;
  const hp = new Map(ids.map((id) => [id, hpStart]));

  const rounds: ReplayRound[] = [];
  for (let i = 0; i < duel.round_count; i += 1) {
    const qid = (duel.question_ids ?? [])[i];
    const q = qRows.find((row) => row.id === qid);
    const roundAnswers = (answers ?? []).filter((a) => a.round_index === i);
    if (!roundAnswers.length && i > 0 && !rounds.length) continue;

    const lines = seats.map((p) => {
      const a = roundAnswers.find((x) => x.employee_id === p.employee_id);
      const dealt = a?.damage ?? 0;
      if (dealt > 0)
        for (const other of ids)
          if (other !== p.employee_id) hp.set(other, Math.max(0, (hp.get(other) ?? hpStart) - dealt));
      return {
        employeeId: p.employee_id,
        displayName: p.display_name,
        answered: !!a,
        isCorrect: !!a?.is_correct,
        msTaken: a?.ms_taken ?? 0,
        damage: dealt,
        firstCorrect: !!a?.first_correct,
        skill: a?.skill ? String(a.skill) : "",
        hpAfter: 0,
      };
    });
    for (const l of lines) l.hpAfter = hp.get(l.employeeId) ?? hpStart;

    rounds.push({
      index: i,
      question: q?.question ?? "(câu hỏi đã bị xoá)",
      correctText: q ? correctTextOf(q) : "",
      explanation: q?.explanation ?? "",
      neutral: lines.every((l) => l.damage === 0),
      timedOut: lines.every((l) => !l.answered),
      lines,
    });
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

  return {
    duelId: duel.id,
    finishedAt: duel.finished_at,
    isRanked: duel.is_ranked,
    roundCount: duel.round_count,
    hpStart,
    quizTitle,
    winnerEmployeeId: duel.winner_employee_id,
    players: seats.map((p) => {
      const prof = (profiles ?? []).find((x) => x.employee_id === p.employee_id);
      return {
        employeeId: p.employee_id,
        displayName: p.display_name,
        unit: p.unit,
        hp: p.hp ?? hpStart,
        damageDealt: p.damage_dealt ?? 0,
        correct: p.correct,
        score: p.score,
        eloBefore: p.elo_before,
        eloAfter: p.elo_after,
        avatarUrl: String(prof?.avatar_url ?? ""),
        avatarImage: String(prof?.avatar_image ?? ""),
        level: levelProgress(Number(prof?.xp ?? 0)).level,
      };
    }),
    rounds,
  };
}
