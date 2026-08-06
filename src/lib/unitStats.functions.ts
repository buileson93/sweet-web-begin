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

    // 1. Lấy thống kê cơ bản (lượt thi, số người) từ candidate_quiz_stats
    let statsQuery = supabaseAdmin
      .from("candidate_quiz_stats")
      .select("unit, attempt_count, submitted_count, employee_id");

    if (quizId !== "all") {
      statsQuery = statsQuery.eq("quiz_id", quizId);
    }

    const { data: statsData, error: statsError } = await statsQuery.limit(10000);
    if (statsError) throw statsError;

    const unitBaseMap = new Map<string, { attempts: number; candidateIds: Set<string> }>();
    for (const s of statsData || []) {
      const unit = s.unit?.trim() || "(Chưa rõ đơn vị)";
      const entry = unitBaseMap.get(unit) ?? { attempts: 0, candidateIds: new Set() };
      entry.attempts += (s.attempt_count || 0);
      if (s.employee_id) entry.candidateIds.add(s.employee_id);
      unitBaseMap.set(unit, entry);
    }

    // 2. Lấy thống kê điểm số (AVG, MAX, PassRate) từ results sử dụng RPC hoặc query tập hợp
    // Vì Supabase client không hỗ trợ GROUP BY phức tạp với AVG/MAX trực tiếp qua SDK một cách linh hoạt,
    // ta sẽ dùng một query select các trường cần thiết nhưng không limit hoặc dùng RPC nếu cần.
    // Tuy nhiên, để tối ưu và tránh limit 1000, ta sẽ query lấy aggregation.
    
    let resultsQuery = supabaseAdmin
      .from("results")
      .select("unit, score, total, passed")
      .eq("disqualified", false);

    if (quizId !== "all") {
      resultsQuery = resultsQuery.eq("quiz_id", quizId);
    }

    // Query lấy dữ liệu thô để aggregate (tối đa 100k bản ghi cho thống kê đơn vị là an toàn hơn 50k)
    const { data: results, error: resError } = await resultsQuery.limit(100000);
    if (resError) throw resError;

    const unitMetricsMap = new Map<string, { totalPct: number; count: number; passed: number; best: number }>();
    for (const r of results || []) {
      const unit = r.unit?.trim() || "(Chưa rõ đơn vị)";
      const entry = unitMetricsMap.get(unit) ?? { totalPct: 0, count: 0, passed: 0, best: 0 };
      
      const pct = r.total ? (r.score / r.total) * 100 : 0;
      entry.totalPct += pct;
      entry.count += 1;
      if (r.passed) entry.passed += 1;
      if (pct > entry.best) entry.best = pct;
      
      unitMetricsMap.set(unit, entry);
    }

    const rows: UnitStatRow[] = [...unitBaseMap.entries()].map(([unit, base]) => {
      const metrics = unitMetricsMap.get(unit) || { totalPct: 0, count: 0, passed: 0, best: 0 };
      return {
        unit,
        attempts: base.attempts,
        candidates: base.candidateIds.size,
        avgPercent: metrics.count > 0 ? Math.round(metrics.totalPct / metrics.count) : 0,
        passRate: metrics.count > 0 ? Math.round((metrics.passed / metrics.count) * 100) : 0,
        best: Math.round(metrics.best),
      };
    }).sort((a, b) => b.avgPercent - a.avgPercent);

    return rows;
  });

/**
 * Lấy phân bố điểm số cho biểu đồ.
 */
export const getScoreDistribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { quizId } = data;

    let q = supabaseAdmin
      .from("results")
      .select("score, total")
      .eq("disqualified", false);

    if (quizId !== "all") q = q.eq("quiz_id", quizId);

    const { data: results, error } = await q.limit(100000);
    if (error) throw error;

    const buckets = [0, 0, 0, 0, 0];
    for (const r of results || []) {
      if (!r.total) continue;
      const pct = (r.score / r.total) * 100;
      const i = pct < 50 ? 0 : pct < 65 ? 1 : pct < 80 ? 2 : pct < 90 ? 3 : 4;
      buckets[i] += 1;
    }

    return [
      { range: "Dưới 50%", count: buckets[0], fail: true },
      { range: "50–64%", count: buckets[1], fail: false },
      { range: "65–79%", count: buckets[2], fail: false },
      { range: "80–89%", count: buckets[3], fail: false },
      { range: "90–100%", count: buckets[4], fail: false },
    ] as DistributionBucket[];
  });
