/**
 * Sảnh Đấu trường: đăng nhập nhanh, hồ sơ, lời mời, bảng xếp hạng, lịch sử.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensurePlayer } from "@/lib/arena/duel.server";
import { issueArenaToken } from "@/lib/arena/token.server";
import type { ArenaProfile } from "@/lib/arena/types";
import { levelProgress, levelTitle } from "@/lib/xp";
import { verifyEmployee } from "@/lib/employees.server";

export async function arenaLogin(input: {
  name: string;
  credential: string;
  extraCredential?: string;
}) {
  const employee = await verifyEmployee(input);
  const player = await ensurePlayer(employee.id, employee.fullName, employee.unitName ?? "");
  if (player.blocked) throw new Error("Tài khoản của bạn đang bị tạm khoá thi đấu.");
  return {
    token: await issueArenaToken(employee.id),
    profile: await getProfile(employee.id),
  };
}

export async function getProfile(employeeId: string): Promise<ArenaProfile> {
  const { data: p } = await supabaseAdmin
    .from("players")
    .select("*")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (!p) throw new Error("Chưa có hồ sơ đấu thủ.");

  const { data: badges } = await supabaseAdmin
    .from("player_badges")
    .select("badge_code, earned_at, badges(name, icon)")
    .eq("employee_id", employeeId)
    .order("earned_at", { ascending: false });

  const total = p.games + p.abandons;
  return {
    employeeId,
    displayName: p.display_name,
    unit: p.unit,
    elo: p.elo,
    games: p.games,
    wins: p.wins,
    losses: p.losses,
    draws: p.draws,
    streak: p.streak,
    bestStreak: p.best_streak,
    coins: p.coins,
    abandons: p.abandons,
    abandonRate: total ? Math.round((p.abandons / total) * 100) : 0,
    rankedLockedUntil: p.ranked_locked_until,
    avatar: p.avatar,
    badges: (badges ?? []).map((b) => ({
      code: b.badge_code,
      name: (b as { badges?: { name?: string } }).badges?.name ?? b.badge_code,
      icon: (b as { badges?: { icon?: string } }).badges?.icon ?? "🏅",
      earnedAt: b.earned_at,
    })),
  };
}

/** Bảng xếp hạng rút gọn — đọc từ view đã ẩn thông tin nhạy cảm. */
export async function getArenaLeaderboard(limit = 10) {
  const { data } = await supabaseAdmin
    .from("arena_leaderboard")
    .select("*")
    .limit(Math.min(100, limit));
  const rows = data ?? [];
  const byUnit = new Map<string, { unit: string; elo: number; players: number }>();
  for (const r of rows) {
    const unit = r.unit || "Chưa cập nhật";
    const cur = byUnit.get(unit) ?? { unit, elo: 0, players: 0 };
    cur.elo += r.elo ?? 0;
    cur.players += 1;
    byUnit.set(unit, cur);
  }
  const units = [...byUnit.values()]
    .map((u) => ({ unit: u.unit, avgElo: Math.round(u.elo / u.players), players: u.players }))
    .sort((a, b) => b.avgElo - a.avgElo)
    .slice(0, 5);
  return { players: rows, units };
}

/** Lời mời đến và lời mời đã gửi còn hiệu lực. */
export async function getInvites(employeeId: string) {
  const now = new Date().toISOString();
  const { data: incoming } = await supabaseAdmin
    .from("duel_invites")
    .select("id, duel_id, from_employee_id, from_name, expires_at")
    .eq("to_employee_id", employeeId)
    .eq("status", "pending")
    .gt("expires_at", now)
    .order("created_at", { ascending: false });

  const { data: outgoing } = await supabaseAdmin
    .from("duel_invites")
    .select("id, duel_id, to_employee_id, status, expires_at")
    .eq("from_employee_id", employeeId)
    .in("status", ["pending", "declined"])
    .gt("created_at", new Date(Date.now() - 300_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(5);

  return { incoming: incoming ?? [], outgoing: outgoing ?? [] };
}

/** 10 trận gần nhất của một đấu thủ. */
export async function getDuelHistory(employeeId: string) {
  const { data: mine } = await supabaseAdmin
    .from("duel_players")
    .select("duel_id, score, correct, elo_before, elo_after, joined_at")
    .eq("employee_id", employeeId)
    .not("elo_after", "is", null)
    .order("joined_at", { ascending: false })
    .limit(10);
  const ids = (mine ?? []).map((m) => m.duel_id);
  if (!ids.length) return [];

  const { data: others } = await supabaseAdmin
    .from("duel_players")
    .select("duel_id, employee_id, display_name, score")
    .in("duel_id", ids);
  const { data: duels } = await supabaseAdmin
    .from("duels")
    .select("id, finished_at, is_ranked, winner_employee_id")
    .in("id", ids);

  return (mine ?? []).map((m) => {
    const opp = (others ?? []).find((o) => o.duel_id === m.duel_id && o.employee_id !== employeeId);
    const duel = (duels ?? []).find((d) => d.id === m.duel_id);
    return {
      duelId: m.duel_id,
      opponent: opp?.display_name ?? "Đối thủ",
      score: m.score,
      opponentScore: opp?.score ?? 0,
      eloDelta: (m.elo_after ?? m.elo_before) - m.elo_before,
      isRanked: duel?.is_ranked ?? false,
      won: duel?.winner_employee_id === employeeId,
      draw: duel?.winner_employee_id === null,
      finishedAt: duel?.finished_at ?? m.joined_at,
    };
  });
}

/** Đổi biểu tượng đại diện trong đấu trường. */
export async function setArenaAvatar(employeeId: string, avatar: string) {
  await supabaseAdmin
    .from("players")
    .update({ avatar: avatar.slice(0, 8) })
    .eq("employee_id", employeeId);
  return { ok: true };
}

/**
 * Tìm đồng nghiệp theo TÊN để gửi lời mời thách đấu.
 * Chỉ trả về thông tin hiển thị (tên, đơn vị, cấp độ, avatar) — không lộ dữ liệu cá nhân.
 */
export async function searchOpponents(input: { employeeId: string; query: string; limit?: number }) {
  const q = input.query.trim();
  if (q.length < 2) return [];

  const { data: rows } = await supabaseAdmin
    .from("employees")
    .select("id, full_name, unit_name")
    .eq("is_active", true)
    .ilike("full_name", `%${q}%`)
    .neq("id", input.employeeId)
    .order("full_name", { ascending: true })
    .limit(Math.min(20, input.limit ?? 10));

  const list = rows ?? [];
  if (list.length === 0) return [];

  const ids = list.map((r) => r.id);
  const [{ data: profiles }, { data: arena }] = await Promise.all([
    supabaseAdmin.from("player_profiles").select("employee_id, xp, avatar_url, avatar_image").in("employee_id", ids),
    supabaseAdmin.from("players").select("employee_id, elo").in("employee_id", ids),
  ]);

  return list.map((r) => {
    const prof = (profiles ?? []).find((p) => p.employee_id === r.id);
    const level = levelProgress(Number(prof?.xp ?? 0)).level;
    return {
      employeeId: r.id,
      fullName: r.full_name,
      unit: r.unit_name ?? "",
      level,
      title: levelTitle(level),
      elo: Number((arena ?? []).find((a) => a.employee_id === r.id)?.elo ?? 1000),
      avatarUrl: String(prof?.avatar_url ?? ""),
      avatarImage: String(prof?.avatar_image ?? ""),
    };
  });
}
