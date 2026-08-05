import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ quizId: z.string().uuid().or(z.literal("all")) });

export const getQuizStatsSummary = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { quizId } = data;

    // 1. Lấy tổng số nhân viên đang hoạt động
    const { count: totalEmployees } = await supabaseAdmin
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    // 2. Lấy dữ liệu tổng hợp từ bảng candidate_quiz_stats (Optimization)
    let statsQuery = supabaseAdmin
      .from("candidate_quiz_stats")
      .select("employee_id, attempt_count, submitted_count");
    
    if (quizId !== "all") {
      statsQuery = statsQuery.eq("quiz_id", quizId);
    }
    
    const { data: statsData } = await statsQuery.limit(10000);
    
    // Tổng số lượt thi (không deduplicate)
    const totalAttempts = (statsData || []).reduce((sum, s) => sum + (s.attempt_count || 0), 0);
    // Số người đã nộp ít nhất 1 lần
    const submittedUniqueCount = (statsData || []).filter(s => (s.submitted_count || 0) > 0).length;

    // 3. Đếm số người ĐẠT (Deduplicated)
    let passedQuery = supabaseAdmin
      .from("results")
      .select("employee_id")
      .eq("disqualified", false)
      .eq("passed", true);
    
    if (quizId !== "all") {
      passedQuery = passedQuery.eq("quiz_id", quizId);
    }
    
    const { data: passedData } = await passedQuery.limit(10000);
    const passedUniqueCount = new Set(passedData?.map(d => d.employee_id).filter(Boolean)).size;

    const total = totalEmployees ?? 0;
    
    return {
      totalEmployees: total,
      submittedCount: submittedUniqueCount,
      notSubmittedCount: Math.max(0, total - submittedUniqueCount),
      passedCount: passedUniqueCount,
      failedCount: Math.max(0, submittedUniqueCount - passedUniqueCount),
      totalAttempts: totalAttempts
    };
  });
