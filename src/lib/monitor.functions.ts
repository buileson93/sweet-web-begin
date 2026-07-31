import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LiveSession = {
  id: string;
  quizId: string;
  quizTitle: string;
  candidateName: string;
  unit: string;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  status: string;
  answered: number;
  total: number;
};

/** Ai được xem màn hình theo dõi: quản trị, kỹ thuật (staff) hoặc biên soạn đề. */
async function assertMonitor(context: { supabase: any; userId: string }) {
  const roles = await Promise.all(
    (["admin", "staff", "editor"] as const).map((role) =>
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: role }),
    ),
  );
  if (!roles.some((r) => r.data === true)) {
    throw new Error("Tài khoản không có quyền theo dõi kỳ thi.");
  }
}

/** Danh sách phiên thi đang diễn ra + vừa nộp trong 2 giờ gần nhất. */
export const listLiveSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LiveSession[]> => {
    await assertMonitor(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("exam_sessions")
      .select("id, quiz_id, candidate_name, unit, started_at, expires_at, submitted_at, status, answers, question_ids")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);

    const quizIds = [...new Set((data ?? []).map((s) => s.quiz_id))];
    const titles = new Map<string, string>();
    if (quizIds.length) {
      const { data: quizzes } = await supabaseAdmin.from("quizzes").select("id, title").in("id", quizIds);
      for (const q of quizzes ?? []) titles.set(q.id, q.title);
    }

    return (data ?? []).map((s) => ({
      id: s.id,
      quizId: s.quiz_id,
      quizTitle: titles.get(s.quiz_id) ?? "—",
      candidateName: s.candidate_name,
      unit: s.unit ?? "",
      startedAt: s.started_at,
      expiresAt: s.expires_at,
      submittedAt: s.submitted_at,
      status: s.status,
      answered: Object.keys((s.answers ?? {}) as Record<string, unknown>).length,
      total: (s.question_ids ?? []).length,
    }));
  });
