/**
 * Ván luyện tập với trợ lý máy và danh sách bộ đề dùng cho đấu trường.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BOT_TIERS, tierOf } from "@/lib/arena/bot";
import { createDuel, setReady } from "@/lib/arena/duel.server";

/** Danh sách bộ đề (cuộc thi) có thể chọn khi so tài. */
export async function listArenaQuizzes() {
  const { data: quizzes } = await supabaseAdmin
    .from("quizzes")
    .select("id, title, cover_url")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = quizzes ?? [];
  const counts = await Promise.all(
    rows.map(async (q) => {
      const { count } = await supabaseAdmin
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("quiz_id", q.id)
        .eq("is_archived", false);
      return count ?? 0;
    }),
  );

  return rows
    .map((q, i) => ({
      id: q.id,
      title: q.title,
      coverUrl: q.cover_url ?? "",
      questionCount: counts[i],
    }))
    .filter((q) => q.questionCount >= 5);
}

/** Các mức độ trợ lý luyện tập hiển thị cho người dùng. */
export function listBotTiers() {
  return BOT_TIERS.map((t) => ({ id: t.id, label: t.label }));
}

/** Mở ngay một ván luyện tập với trợ lý máy (không tính xếp hạng). */
export async function startBotDuel(input: {
  employeeId: string;
  tier?: string;
  quizId?: string | null;
  roundCount?: number;
  secondsPerRound?: number;
  deviceHash?: string;
}): Promise<{ duelId: string }> {
  const tier = tierOf(input.tier);

  const { data: busy } = await supabaseAdmin
    .from("duel_players")
    .select("employee_id")
    .in("employee_id", tier.employeeIds)
    .is("left_at", null)
    .in("duel_status", ["waiting", "countdown", "playing"]);

  const taken = new Set((busy ?? []).map((b) => b.employee_id));
  const freeBot = tier.employeeIds.find((id) => !taken.has(id));
  if (!freeBot) throw new Error("Trợ lý mức này đang bận. Bạn hãy chọn mức khác nhé.");

  const { duelId } = await createDuel({
    employeeId: input.employeeId,
    quizId: input.quizId ?? null,
    roundCount: input.roundCount,
    secondsPerRound: input.secondsPerRound,
    isRanked: false,
    isBot: true,
    note: `bot:${tier.id}`,
    deviceHash: input.deviceHash,
  });

  const { data: bot } = await supabaseAdmin
    .from("players")
    .select("display_name, unit, elo")
    .eq("employee_id", freeBot)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("duel_players").insert({
    duel_id: duelId,
    employee_id: freeBot,
    seat: 1,
    display_name: bot?.display_name ?? "Trợ lý luyện tập",
    unit: bot?.unit ?? "Trợ lý luyện tập",
    elo_before: bot?.elo ?? 1000,
    ready: true,
    device_hash: "bot",
  });
  if (error) throw new Error("Không mở được ván luyện tập. Bạn thử lại nhé.");

  // Người thật sẵn sàng ngay để vào trận không phải chờ.
  await setReady({ employeeId: input.employeeId, duelId });
  return { duelId };
}
