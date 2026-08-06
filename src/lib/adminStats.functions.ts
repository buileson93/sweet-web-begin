import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Server-side pagination for Results Manager */
export const listPaginatedResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        quizId: z.string().uuid().or(z.literal("all")),
        keyword: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isStaff } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "staff",
    });
    if (!isAdmin && !isStaff) throw new Error("Unauthorized");

    let query = supabaseAdmin
      .from("results")
      .select("*", { count: "exact" })
      .order("submitted_at", { ascending: false });

    if (data.quizId !== "all") {
      query = query.eq("quiz_id", data.quizId);
    }

    if (data.keyword) {
      const kw = `%${data.keyword}%`;
      query = query.or(`candidate_name.ilike.${kw},unit.ilike.${kw}`);
    }

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    const { data: rows, count, error } = await query.range(from, to);
    if (error) throw new Error(error.message);

    return {
      items: rows || [],
      total: count || 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

export const getQuizStatsSummary = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ quizId: z.string().uuid().or(z.literal("all")) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { quizId } = data;

    const { count: totalEmployees } = await supabaseAdmin
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    let statsQuery = supabaseAdmin
      .from("candidate_quiz_stats")
      .select("employee_id, candidate_name, unit, attempt_count, submitted_count, last_updated_at");
    
    if (quizId !== "all") {
      statsQuery = statsQuery.eq("quiz_id", quizId);
    }
    
    const { data: statsData } = await statsQuery.limit(50000);
    const stats = statsData || [];

    const uniqueParticipants = new Set();
    let totalAttempts = 0;
    let submittedUniqueCount = 0;
    let latestUpdate: string | null = null;

    for (const s of stats) {
      const key = s.employee_id || `${(s.candidate_name || "").trim().toLowerCase()}|${(s.unit || "").trim().toLowerCase()}`;
      uniqueParticipants.add(key);
      totalAttempts += (s.attempt_count || 0);
      if ((s.submitted_count || 0) > 0) {
        submittedUniqueCount++;
      }
      if (s.last_updated_at && (!latestUpdate || s.last_updated_at > latestUpdate)) {
        latestUpdate = s.last_updated_at;
      }
    }

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
      submittedCount: submittedUniqueCount,
      notSubmittedCount: Math.max(0, total - submittedUniqueCount),
      passedCount: passedUniqueCount,
      failedCount: Math.max(0, submittedUniqueCount - passedUniqueCount),
      totalAttempts: totalAttempts,
      lastUpdatedAt: latestUpdate
    };
  });

/** Thống kê nhanh cho nhiều cuộc thi (dùng cho trang chủ) */
export const getMultiQuizBasicStats = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ quizIds: z.array(z.string().uuid()) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { quizIds } = data;

    const { data: stats } = await supabaseAdmin
      .from("candidate_quiz_stats")
      .select("quiz_id, attempt_count, submitted_count")
      .in("quiz_id", quizIds);

    const { data: passedData } = await supabaseAdmin
      .from("results")
      .select("quiz_id, id")
      .eq("passed", true)
      .eq("disqualified", false)
      .in("quiz_id", quizIds);

    const out: Record<string, { attempts: number; passed: number }> = {};
    quizIds.forEach((id) => {
      const quizStats = stats?.filter((s) => s.quiz_id === id) || [];
      const attempts = quizStats.reduce((sum, s) => sum + (s.attempt_count || 0), 0);
      const passed = passedData?.filter((r) => r.quiz_id === id).length || 0;
      out[id] = { attempts, passed };
    });
    return out;
  });

/** Thống kê chi tiết nhắc nhở tham gia cho một cuộc thi */
export const getDetailedParticipation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ quizId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isStaff } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "staff",
    });
    if (!isAdmin && !isStaff) throw new Error("Unauthorized");

    // 1. Lấy danh sách toàn bộ nhân viên hoạt động
    const { data: employees, error: empError } = await supabaseAdmin
      .from("employees")
      .select("id, full_name, unit_name, phone, position")
      .eq("is_active", true)
      .limit(10000); // Tăng giới hạn lấy danh sách nhân viên

      .order("full_name");
    
    if (empError) throw new Error(empError.message);

    // 2. Lấy chỉ số thi của cuộc thi này từ candidate_quiz_stats (chứa attempt_count, submitted_count)
    const { data: stats, error: statsError } = await supabaseAdmin
      .from("candidate_quiz_stats")
      .select("employee_id, candidate_name, unit, attempt_count, submitted_count")
      .eq("quiz_id", data.quizId)
      .limit(50000); // Tăng limit để lấy toàn bộ danh sách thí sinh đã tham gia

    
    if (statsError) throw new Error(statsError.message);

    // 3. Lấy kết quả tốt nhất của mỗi người để check xem đạt hay chưa
    const { data: results, error: resError } = await supabaseAdmin
      .from("results")
      .select("employee_id, candidate_name, unit, passed, score, total")
      .eq("quiz_id", data.quizId)
      .eq("disqualified", false)
      .limit(100000); // Tăng limit để lấy toàn bộ kết quả nộp bài thành công


    if (resError) throw new Error(resError.message);

    // Map dữ liệu
    const statsMap = new Map();
    stats?.forEach(s => {
      const key = s.employee_id || `${s.candidate_name}|${s.unit}`;
      statsMap.set(key, s);
    });

    const resultsMap = new Map();
    results?.forEach(r => {
      const key = r.employee_id || `${r.candidate_name}|${r.unit}`;
      const existing = resultsMap.get(key);
      // Giữ kết quả cao nhất hoặc ưu tiên passed=true
      if (!existing || (!existing.passed && r.passed) || (r.score / r.total > existing.score / existing.total)) {
        resultsMap.set(key, r);
      }
    });

    const combined = employees.map(emp => {
      const key = emp.id;
      const stat = statsMap.get(key);
      const res = resultsMap.get(key);

      let status: "passed" | "failed" | "pending" | "none" = "none";
      if (res?.passed) status = "passed";
      else if (res) status = "failed"; // Đã nộp nhưng không đạt
      else if (stat && stat.attempt_count > 0) status = "pending"; // Đang thi nhưng chưa nộp bản nào thành công

      return {
        id: emp.id,
        fullName: emp.full_name,
        unit: emp.unit_name,
        phone: emp.phone,
        position: emp.position,
        status,
        attempts: stat?.attempt_count || 0,
        submitted: stat?.submitted_count || 0,
        bestScore: res ? `${res.score}/${res.total}` : null
      };
    });

    return combined;
  });
