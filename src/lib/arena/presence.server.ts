/**
 * Trạng thái trực tuyến của đấu thủ và xử lý ván so tài đang dang dở.
 * Máy chủ xác nhận ai đang trực tuyến (nhịp tim mỗi 20 giây), client không tự khai.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { finishDuel, leaveDuel } from "@/lib/arena/duel.server";
import { levelProgress, levelTitle } from "@/lib/xp";

/** Quá thời gian này không có nhịp tim thì coi như đã rời mạng. */
export const ONLINE_WINDOW_MS = 60_000;

const ACTIVE_STATUSES = ["waiting", "countdown", "playing"];

/** Ghi nhận nhịp tim của đấu thủ. */
export async function touchPresence(employeeId: string) {
  await supabaseAdmin
    .from("players")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("employee_id", employeeId);
  return { ok: true };
}

export type OnlinePlayer = {
  employeeId: string;
  displayName: string;
  unit: string;
  elo: number;
  level: number;
  title: string;
  avatarUrl: string;
  avatarImage: string;
  busy: boolean;
  lastSeenAt: string;
};

/** Danh sách đồng nghiệp đang trực tuyến, kèm trạng thái đang bận so tài. */
export async function listOnlinePlayers(input: {
  employeeId: string;
  limit?: number;
}): Promise<OnlinePlayer[]> {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
  const { data: rows } = await supabaseAdmin
    .from("players")
    .select("employee_id, display_name, unit, elo, last_seen_at, blocked")
    .gte("last_seen_at", since)
    .neq("employee_id", input.employeeId)
    .order("last_seen_at", { ascending: false })
    .limit(Math.min(60, input.limit ?? 30));

  const list = (rows ?? []).filter((r) => !r.blocked);
  if (!list.length) return [];
  const ids = list.map((r) => r.employee_id);

  const [{ data: profiles }, { data: busyRows }] = await Promise.all([
    supabaseAdmin
      .from("player_profiles")
      .select("employee_id, xp, avatar_url, avatar_image")
      .in("employee_id", ids),
    supabaseAdmin
      .from("duel_players")
      .select("employee_id")
      .in("employee_id", ids)
      .is("left_at", null)
      .in("duel_status", ACTIVE_STATUSES),
  ]);

  const busy = new Set((busyRows ?? []).map((b) => b.employee_id));
  return list.map((r) => {
    const prof = (profiles ?? []).find((p) => p.employee_id === r.employee_id);
    const level = levelProgress(Number(prof?.xp ?? 0)).level;
    return {
      employeeId: r.employee_id,
      displayName: r.display_name,
      unit: r.unit || "Chưa cập nhật",
      elo: r.elo,
      level,
      title: levelTitle(level),
      avatarUrl: String(prof?.avatar_url ?? ""),
      avatarImage: String(prof?.avatar_image ?? ""),
      busy: busy.has(r.employee_id),
      lastSeenAt: r.last_seen_at,
    };
  });
}

export type ActiveDuelInfo = {
  duelId: string;
  status: string;
  opponent: string;
} | null;

/** Ván so tài mà người này đang tham gia (nếu có). */
export async function getActiveDuel(employeeId: string): Promise<ActiveDuelInfo> {
  const { data } = await supabaseAdmin
    .from("duel_players")
    .select("duel_id, duel_status")
    .eq("employee_id", employeeId)
    .is("left_at", null)
    .in("duel_status", ACTIVE_STATUSES)
    .order("joined_at", { ascending: false })
    .maybeSingle();
  if (!data) return null;

  const { data: others } = await supabaseAdmin
    .from("duel_players")
    .select("employee_id, display_name")
    .eq("duel_id", data.duel_id)
    .neq("employee_id", employeeId);

  return {
    duelId: data.duel_id,
    status: data.duel_status,
    opponent: others?.[0]?.display_name ?? "Chưa có đối thủ",
  };
}

/**
 * Kết thúc dứt điểm ván so tài đang dang dở để người dùng thoát khỏi trạng thái kẹt.
 * Ván chưa bắt đầu thì huỷ; ván đang diễn ra thì tính là bỏ cuộc.
 */
export async function endActiveDuel(employeeId: string) {
  const active = await getActiveDuel(employeeId);
  if (!active) return { ended: false, duelId: null as string | null };

  await leaveDuel({ employeeId, duelId: active.duelId });

  if (active.status === "playing") {
    await finishDuel(active.duelId, employeeId);
  } else {
    await supabaseAdmin
      .from("duels")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", active.duelId)
      .in("status", ["waiting", "countdown"]);
  }
  return { ended: true, duelId: active.duelId };
}
