import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  quizId: z.string().uuid().or(z.literal("all")),
});

export type UnitStatRow = {
  unit: string;
  attempts: number;
  candidates: number;
  avgPercent: number;
  passRate: number;
  best: number;
};

export type DistributionBucket = {
  range: string;
  count: number;
  fail: boolean;
};

/**
 * Lấy thống kê theo đơn vị sử dụng SQL Aggregation để đảm bảo chính xác trên toàn bộ database.
 */
export const getUnitStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { quizId } = data;

    // Kiểm tra quyền admin/staff
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isStaff } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "staff",
    });
    if (!isAdmin && !isStaff) throw new Error("Unauthorized");

    // Sử dụng RPC get_unit_statistics để lấy dữ liệu đã được tổng hợp từ database
    // Dùng as any để tránh lỗi type strict của Supabase client với null value trong params
    const { data: rows, error } = await supabaseAdmin.rpc("get_unit_statistics", {
      _quiz_id: (quizId === "all" ? undefined : quizId) as any,
    });

    if (error) throw error;

    // Convert numeric results from RPC to the expected UnitStatRow types
    return (rows || []).map((r: any) => ({
      unit: r.unit,
      attempts: Number(r.attempts),
      candidates: Number(r.candidates),
      avgPercent: Number(r.avg_percent),
      passRate: Number(r.pass_rate),
      best: Number(r.best),
    })) as UnitStatRow[];
  });

/**
 * Lấy phân bố điểm số cho biểu đồ bằng SQL Aggregation RPC.
 */
export const getScoreDistribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { quizId } = data;

    const { data: distribution, error } = await supabaseAdmin.rpc("get_score_distribution_stats", {
      _quiz_id: (quizId === "all" ? undefined : quizId) as any,
    });

    if (error) throw error;

    return (distribution || []).map((d: any) => ({
      range: d.range,
      count: Number(d.count),
      fail: d.fail,
    })) as DistributionBucket[];
  });
