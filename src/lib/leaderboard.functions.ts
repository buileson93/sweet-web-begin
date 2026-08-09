import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  quizId: z.string().uuid().or(z.literal("all")),
  limit: z.number().optional().default(5000)
});

export const getRankableResults = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { quizId, limit } = data;

    // 1. Lấy kết quả đã nộp
    let query = supabaseAdmin
      .from("results")
      .select("id, candidate_name, unit, score, total, time_seconds, time_ms, submitted_at, quiz_title, quiz_id, points, max_points, best_streak, employee_id")
      .eq("disqualified", false)
      .order("score", { ascending: false })
      .order("time_seconds", { ascending: true })
      .limit(limit);

    if (quizId !== "all") {
      query = query.eq("quiz_id", quizId);
    }

    const { data: results, error } = await query;
    if (error) throw error;

    // 2. Lấy TỔNG số lượt thi từ bảng thống kê (ưu tiên tốc độ)
    let statsQuery = supabaseAdmin
      .from('candidate_quiz_stats')
      .select('employee_id, candidate_name, unit, attempt_count, submitted_count');

    if (quizId !== 'all') {
      statsQuery = statsQuery.eq('quiz_id', quizId);
    }
    
    const { data: allStats, error: statsError } = await statsQuery.limit(limit);
    if (statsError) throw statsError;

    const finalAttemptMap = new Map<string, { attempts: number; submitted: number }>();
    for (const s of allStats || []) {
      const key = s.employee_id || `${(s.candidate_name || "").trim().toLowerCase()}|${(s.unit || "").trim().toLowerCase()}`;
      finalAttemptMap.set(key, { 
        attempts: s.attempt_count || 0, 
        submitted: s.submitted_count || 0 
      });
    }

    // Gắn số lượt thi thực tế vào kết quả trả về
    const resultsWithRealAttempts = (results || []).map(r => {
      const key = r.employee_id || `${(r.candidate_name || "").trim().toLowerCase()}|${(r.unit || "").trim().toLowerCase()}`;
      const stats = finalAttemptMap.get(key);
      return {
        ...r,
        attempts: stats?.attempts || 1,
        submitted: stats?.submitted || 1
      };
    });

    return resultsWithRealAttempts;
  });
