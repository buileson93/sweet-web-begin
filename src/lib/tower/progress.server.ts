/**
 * Tiến trình Leo Tháp — MỘT dòng cho mỗi nhân viên, không ghi nhật ký từng câu.
 * Dung lượng tăng theo số người chơi, không tăng theo số lần chơi.
 */
import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyEmployee } from "@/lib/employees.server";
import { assertTowerOpen, getBankVersion } from "@/lib/tower/bank.server";
import { mergeStates, normalizeState, pruneState, type TowerState } from "@/lib/tower/state";

type VerifyInput = { name: string; credential: string; extraCredential?: string };

export type TowerOpenResult = {
  employeeId: string;
  displayName: string;
  bankVersion: number;
  state: TowerState;
  runs: number;
  bestStage: number;
  coins: number;
};

/** Một lượt đi về duy nhất khi mở Leo Tháp: danh tính + tiến trình + phiên bản đề. */
export async function openTower(input: VerifyInput): Promise<TowerOpenResult> {
  const employee = await verifyEmployee(input);
  await assertTowerOpen();

  const [{ data: row }, bankVersion] = await Promise.all([
    supabaseAdmin
      .from("tower_progress")
      .select("state, runs, best_stage, coins")
      .eq("employee_id", employee.id)
      .maybeSingle(),
    getBankVersion(),
  ]);

  return {
    employeeId: employee.id,
    displayName: employee.fullName,
    bankVersion,
    state: normalizeState(row?.state),
    runs: row?.runs ?? 0,
    bestStage: row?.best_stage ?? 0,
    coins: row?.coins ?? 0,
  };
}

export type TowerSyncInput = VerifyInput & {
  state: unknown;
  runs?: number;
  bestStage?: number;
  coins?: number;
};

/**
 * Đồng bộ sau khi kết thúc phiên (hoặc khi rời trang).
 * Hợp nhất với bản trên máy chủ để chơi hai thiết bị không mất tiến trình.
 */
export async function syncTower(input: TowerSyncInput): Promise<{ state: TowerState; bytes: number }> {
  const employee = await verifyEmployee(input);

  const { data: row } = await supabaseAdmin
    .from("tower_progress")
    .select("state, runs, best_stage, coins")
    .eq("employee_id", employee.id)
    .maybeSingle();

  const merged = pruneState(mergeStates(normalizeState(row?.state), normalizeState(input.state)));

  const payload = {
    employee_id: employee.id,
    state: JSON.parse(JSON.stringify(merged)) as Json,
    runs: Math.max(row?.runs ?? 0, input.runs ?? 0),
    best_stage: Math.max(row?.best_stage ?? 0, input.bestStage ?? 0),
    coins: Math.max(row?.coins ?? 0, input.coins ?? 0),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from("tower_progress").upsert(payload, { onConflict: "employee_id" });
  if (error) throw new Error("Không lưu được tiến trình Leo Tháp.");

  return { state: merged, bytes: JSON.stringify(merged).length };
}
