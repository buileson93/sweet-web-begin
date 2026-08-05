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

    // 2. Lấy dữ liệu tổng hợp từ bảng candidate_quiz_stats
    let statsQuery = supabaseAdmin
      .from("candidate_quiz_stats")
      .select("employee_id, candidate_name, unit, attempt_count, submitted_count");
    
    if (quizId !== "all") {
      statsQuery = statsQuery.eq("quiz_id", quizId);
    }
    
    const { data: statsData } = await statsQuery.limit(50000);
    const stats = statsData || [];

    // Tính toán dựa trên employee_id hoặc name|unit để deduplicate
    const uniqueParticipants = new Set();
    let totalAttempts = 0;
    let submittedUniqueCount = 0;

    for (const s of stats) {
      const key = s.employee_id || `${(s.candidate_name || "").trim().toLowerCase()}|${(s.unit || "").trim().toLowerCase()}`;
      uniqueParticipants.add(key);
      totalAttempts += (s.attempt_count || 0);
      if ((s.submitted_count || 0) > 0) {
        submittedUniqueCount++;
      }
    }

    // 3. Đếm số người ĐẠT (Deduplicated)
    let passedQuery = supabaseAdmin
      .from("results")
      .select("employee_id, candidate_name, unit")
      .eq("disqualified", false)
      .eq("passed", true);
    
    if (quizId !== "all") {
      passedQuery = passedQuery.eq("quiz_id", quizId);
    }
    
    const { data: passedData } = await passedQuery.limit(50000);
    const passedKeys = new Set((passedData || []).map(d => 
      d.employee_id || `${(d.candidate_name || "").trim().toLowerCase()}|${(d.unit || "").trim().toLowerCase()}`
    ));
    const passedUniqueCount = passedKeys.size;

    const total = totalEmployees ?? 0;
    
    return {
      totalEmployees: total,
      submittedCount: submittedUniqueCount, // Số người đã nộp ít nhất 1 lần
      notSubmittedCount: Math.max(0, total - submittedUniqueCount),
      passedCount: passedUniqueCount,
      failedCount: Math.max(0, submittedUniqueCount - passedUniqueCount),
      totalAttempts: totalAttempts
    };
  });
