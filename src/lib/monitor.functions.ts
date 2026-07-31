import { createServerFn } from "@tanstack/react-start";

import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sessionDetailSchema = z.object({ sessionId: z.string().uuid() });

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

/** Danh sách phiên thi đang diễn ra + vừa nộp trong 2 giờ gần nhất. */
export const listLiveSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LiveSession[]> => {
    // Chỉ quản trị, kỹ thuật hoặc biên soạn đề mới được theo dõi.
    const roles = await Promise.all(
      (["admin", "staff", "editor"] as const).map((role) =>
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: role }),
      ),
    );
    if (!roles.some((r) => r.data === true)) {
      throw new Error("Tài khoản không có quyền theo dõi kỳ thi.");
    }

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

export type SessionAnswer = {
  index: number;
  questionId: string;
  question: string;
  options: string[];
  answered: boolean;
  answerLabel: string;
  correctLabel: string;
  isCorrect: boolean;
};

export type SessionDetail = {
  id: string;
  candidateName: string;
  unit: string;
  quizTitle: string;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  status: string;
  points: number;
  bestStreak: number;
  answers: SessionAnswer[];
};

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/** Chi tiết một phiên thi: từng câu hỏi, đáp án thí sinh chọn và đáp án đúng. */
export const getSessionDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sessionDetailSchema.parse(input))
  .handler(async ({ data, context }): Promise<SessionDetail> => {
    const roles = await Promise.all(
      (["admin", "staff", "editor"] as const).map((role) =>
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: role }),
      ),
    );
    if (!roles.some((r) => r.data === true)) {
      throw new Error("Tài khoản không có quyền theo dõi kỳ thi.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session, error } = await supabaseAdmin
      .from("exam_sessions")
      .select(
        "id, quiz_id, candidate_name, unit, started_at, expires_at, submitted_at, status, answers, question_ids, option_orders, points, best_streak",
      )
      .eq("id", data.sessionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!session) throw new Error("Không tìm thấy phiên thi.");

    const [{ data: quiz }, { data: questions }] = await Promise.all([
      supabaseAdmin.from("quizzes").select("title").eq("id", session.quiz_id).maybeSingle(),
      supabaseAdmin
        .from("questions")
        .select("id, question, options, correct_index")
        .in("id", session.question_ids ?? []),
    ]);

    const byId = new Map((questions ?? []).map((q) => [q.id, q]));
    const rawAnswers = (session.answers ?? {}) as Record<string, number | number[] | string>;
    const orders = (session.option_orders ?? []) as number[][];

    const answers: SessionAnswer[] = (session.question_ids ?? []).map((qid: string, index: number) => {
      const q = byId.get(qid);
      const order = Array.isArray(orders[index]) ? orders[index] : null;
      const options = q ? (order ? order.map((i) => q.options[i] ?? "") : q.options) : [];
      const correctPos = q
        ? order
          ? order.indexOf(q.correct_index)
          : q.correct_index
        : -1;
      const picked = rawAnswers[String(index)] ?? rawAnswers[qid];
      const pickedPos = typeof picked === "number" ? picked : Array.isArray(picked) ? picked[0] : undefined;
      const answered = pickedPos !== undefined && pickedPos !== null && pickedPos >= 0;
      return {
        index,
        questionId: qid,
        question: q?.question ?? "(câu hỏi đã bị xoá)",
        options,
        answered,
        answerLabel: answered ? `${LETTERS[pickedPos!] ?? "?"}. ${options[pickedPos!] ?? ""}` : "Chưa trả lời",
        correctLabel: correctPos >= 0 ? `${LETTERS[correctPos] ?? "?"}. ${options[correctPos] ?? ""}` : "—",
        isCorrect: answered && pickedPos === correctPos,
      };
    });

    return {
      id: session.id,
      candidateName: session.candidate_name,
      unit: session.unit ?? "",
      quizTitle: quiz?.title ?? "—",
      startedAt: session.started_at,
      expiresAt: session.expires_at,
      submittedAt: session.submitted_at,
      status: session.status,
      points: session.points ?? 0,
      bestStreak: session.best_streak ?? 0,
      answers,
    };
  });
