/**
 * Hồ sơ người chơi: kinh nghiệm, cấp độ, ảnh đại diện 3D.
 * Chỉ chạy phía máy chủ (dùng service role qua RPC security definer).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { levelProgress, levelTitle } from "@/lib/xp";

export type PlayerProfile = {
  employeeId: string;
  displayName: string;
  unit: string;
  xp: number;
  level: number;
  title: string;
  into: number;
  need: number;
  percent: number;
  examsTaken: number;
  examsPassed: number;
  bestStreak: number;
  avatarUrl: string;
  avatarImage: string;
};

const EMPTY = (employeeId: string): PlayerProfile => ({
  employeeId,
  displayName: "",
  unit: "",
  xp: 0,
  level: 1,
  title: levelTitle(1),
  into: 0,
  need: 100,
  percent: 0,
  examsTaken: 0,
  examsPassed: 0,
  bestStreak: 0,
  avatarUrl: "",
  avatarImage: "",
});

function shape(row: Record<string, unknown>): PlayerProfile {
  const xp = Number(row.xp ?? 0);
  const p = levelProgress(xp);
  return {
    employeeId: String(row.employee_id ?? ""),
    displayName: String(row.display_name ?? ""),
    unit: String(row.unit ?? ""),
    xp,
    level: p.level,
    title: levelTitle(p.level),
    into: p.into,
    need: p.need,
    percent: p.percent,
    examsTaken: Number(row.exams_taken ?? 0),
    examsPassed: Number(row.exams_passed ?? 0),
    bestStreak: Number(row.best_streak ?? 0),
    avatarUrl: String(row.avatar_url ?? ""),
    avatarImage: String(row.avatar_image ?? ""),
  };
}

/** Đọc hồ sơ của một nhân viên (chưa có thì trả hồ sơ rỗng cấp 1). */
export async function readPlayerProfile(employeeId: string): Promise<PlayerProfile> {
  const { data, error } = await supabaseAdmin
    .from("player_profiles")
    .select("*")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? shape(data as never) : EMPTY(employeeId);
}

/** Bảng xếp hạng theo kinh nghiệm. */
export async function readTopPlayers(limit = 20): Promise<PlayerProfile[]> {
  const { data, error } = await supabaseAdmin
    .from("player_profiles")
    .select("*")
    .order("xp", { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => shape(row as never));
}

/** Lưu ảnh đại diện 3D (đã xác thực nhân viên ở lớp gọi). */
export async function writePlayerAvatar(input: {
  employeeId: string;
  avatarUrl: string;
  avatarImage: string;
}) {
  const { error } = await supabaseAdmin.rpc("set_player_avatar", {
    p_employee_id: input.employeeId,
    p_avatar_url: input.avatarUrl,
    p_avatar_image: input.avatarImage,
  });
  if (error) throw new Error(error.message);
  return readPlayerProfile(input.employeeId);
}
