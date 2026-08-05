import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

export const getUnitStats = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { quizId } = data;

    // 1. Lấy kết quả (Results) để tính điểm trung bình và tỉ lệ đạt
    let resultsQuery = supabaseAdmin
      .from("results")
      .select("unit, candidate_name, employee_id, score, total, passed, disqualified")
      .eq("disqualified", false);

    if (quizId !== "all") {
      resultsQuery = resultsQuery.eq("quiz_id", quizId);
    }

    const { data: results, error } = await resultsQuery.limit(50000);
    if (error) throw error;

    // 2. Lấy thống kê lượt thi (Attempts) từ candidate_quiz_stats
    let statsQuery = supabaseAdmin
      .from("candidate_quiz_stats")
      .select("unit, attempt_count, submitted_count");

    if (quizId !== "all") {
      statsQuery = statsQuery.eq("quiz_id", quizId);
    }

    const { data: stats, error: statsError } = await statsQuery.limit(50000);
    if (statsError) throw statsError;

    const unitMap = new Map<string, { scores: number[]; names: Set<string>; passed: number; attempts: number }>();

    // Process attempts first to get total counts per unit
    for (const s of stats || []) {
      const unit = s.unit?.trim() || "(Chưa rõ đơn vị)";
      const entry = unitMap.get(unit) ?? { scores: [], names: new Set<string>(), passed: 0, attempts: 0 };
      entry.attempts += (s.attempt_count || 0);
      unitMap.set(unit, entry);
    }

    // Process results for accuracy metrics
    for (const r of results || []) {
      const unit = r.unit?.trim() || "(Chưa rõ đơn vị)";
      const entry = unitMap.get(unit) ?? { scores: [], names: new Set<string>(), passed: 0, attempts: 0 };
      
      const key = r.employee_id || r.candidate_name;
      if (key) entry.names.add(key);
      
      const pct = r.total ? (r.score / r.total) * 100 : 0;
      entry.scores.push(pct);
      if (r.passed) entry.passed += 1;
      
      unitMap.set(unit, entry);
    }

    const rows: UnitStatRow[] = [...unitMap.entries()]
      .map(([unit, e]) => ({
        unit,
        attempts: e.attempts,
        candidates: e.names.size,
        avgPercent: e.scores.length > 0 ? Math.round(e.scores.reduce((a, b) => a + b, 0) / e.scores.length) : 0,
        passRate: e.scores.length > 0 ? Math.round((e.passed / e.scores.length) * 100) : 0,
        best: e.scores.length > 0 ? Math.round(Math.max(...e.scores)) : 0,
      }))
      .sort((a, b) => b.avgPercent - a.avgPercent);

    return rows;
  });
