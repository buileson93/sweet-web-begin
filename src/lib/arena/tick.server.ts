/**
 * Watchdog của Đấu trường — chạy mỗi 5 giây qua route cron.
 * Máy chủ là nguồn sự thật: kể cả khi mọi trình duyệt đều đóng, trận vẫn tự chạy đúng luật.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DISCONNECT_GRACE_MS, closeRound, finishDuel, startPlaying } from "@/lib/arena/duel.server";
import { softResetElo } from "@/lib/arena/rules";
import { broadcastDuel } from "@/lib/arena/broadcast.server";

const NETWORK_GRACE_MS = 1_500;
/** Trận quá thời lượng này thì cưỡng bức kết thúc. */
const MAX_DUEL_MS = 30 * 60_000;
/** Phòng chờ quá thời gian này mà không đủ người thì huỷ. */
const WAITING_TTL_MS = 5 * 60_000;

export async function tickDuels() {
  const now = Date.now();
  let closed = 0;
  let finished = 0;
  let cancelled = 0;

  // 1) Đếm ngược xong -> phát câu đầu tiên.
  const { data: counting } = await supabaseAdmin
    .from("duels")
    .select("id, started_at")
    .eq("status", "countdown")
    .limit(50);
  for (const d of counting ?? []) {
    if (d.started_at && Date.parse(d.started_at) <= now) {
      await startPlaying(d.id);
    }
  }


  // 2) Câu quá hạn -> chốt câu, sang câu tiếp.
  const { data: playing } = await supabaseAdmin
    .from("duels")
    .select("id, current_round, round_served_at, seconds_per_round, started_at")
    .eq("status", "playing")
    .limit(50);
  for (const d of playing ?? []) {
    if (d.started_at && now - Date.parse(d.started_at) > MAX_DUEL_MS) {
      await finishDuel(d.id);
      finished++;
      continue;
    }
    if (!d.round_served_at) continue;
    const deadline =
      Date.parse(d.round_served_at) + d.seconds_per_round * 1000 + NETWORK_GRACE_MS;
    if (now > deadline) {
      await closeRound(d.id, d.current_round);
      closed++;
    }
  }

  // 3) Rời trận quá 20 giây -> xử thua kỹ thuật.
  const { data: leftRows } = await supabaseAdmin
    .from("duel_players")
    .select("duel_id, employee_id, left_at, duel_status")
    .not("left_at", "is", null)
    .in("duel_status", ["countdown", "playing"])
    .limit(50);
  for (const row of leftRows ?? []) {
    if (row.left_at && now - Date.parse(row.left_at) > DISCONNECT_GRACE_MS) {
      await finishDuel(row.duel_id, row.employee_id);
      finished++;
    }
  }

  // 4) Phòng chờ ế quá 5 phút -> huỷ.
  const { data: stale } = await supabaseAdmin
    .from("duels")
    .select("id")
    .eq("status", "waiting")
    .lt("created_at", new Date(now - WAITING_TTL_MS).toISOString())
    .limit(50);
  for (const d of stale ?? []) {
    await supabaseAdmin
      .from("duels")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", d.id);
    await broadcastDuel(d.id, "lobby.update", { cancelled: true });
    cancelled++;
  }

  // 5) Lời mời quá hạn.
  await supabaseAdmin
    .from("duel_invites")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", new Date(now).toISOString());

  return { closed, finished, cancelled };
}

/** Kết mùa giải: reset mềm Elo, trao danh hiệu quán quân, lưu bảng vàng. */
export async function closeFinishedSeasons() {
  const now = new Date().toISOString();
  const { data: seasons } = await supabaseAdmin
    .from("seasons")
    .select("id, name")
    .is("closed_at", null)
    .lt("ends_at", now)
    .limit(5);
  if (!seasons?.length) return { closed: 0 };

  for (const season of seasons) {
    const { data: top } = await supabaseAdmin
      .from("players")
      .select("employee_id, display_name, unit, elo, wins, losses")
      .gt("games", 0)
      .order("elo", { ascending: false })
      .limit(100);

    if (top?.[0])
      await supabaseAdmin
        .from("player_badges")
        .upsert(
          { employee_id: top[0].employee_id, badge_code: "monthly_king" },
          { onConflict: "employee_id,badge_code", ignoreDuplicates: true },
        );

    for (const p of top ?? []) {
      await supabaseAdmin
        .from("players")
        .update({ elo: softResetElo(p.elo) })
        .eq("employee_id", p.employee_id);
    }

    await supabaseAdmin
      .from("seasons")
      .update({ closed_at: now, standings: (top ?? []) as never })
      .eq("id", season.id);
  }
  return { closed: seasons.length };
}
