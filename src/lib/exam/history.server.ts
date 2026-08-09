import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyEmployee } from "@/lib/employees.server";
import {
  PASS_PERCENT_DEFAULT,
  baseOptions,
  chosenTextOf,
  correctTextOf,
  gradeOne,
  isPassed,
  percentOf,
  type QuestionRow,
} from "@/lib/grading";
import { type AnswerValue } from "@/lib/questionKinds";
import {
  QUESTION_COLUMNS,
  type ExamHistory,
  type HistoryAttempt,
  type HistoryQuestion,
} from "@/lib/exam/types";

/** Lịch sử làm bài của một nhân viên (sau khi đã xác thực danh tính). */
export async function getExamHistoryFor(input: {
  name: string;
  credential: string;
  extraCredential?: string;
}): Promise<ExamHistory> {
  const employee = await verifyEmployee(input);

  const { data: sessions, error } = await supabaseAdmin
    .from("exam_sessions")
    .select("id, quiz_id, started_at, submitted_at, status, question_ids, option_orders, answers")
    .eq("employee_id", employee.id)
    .order("started_at", { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);

  const list = sessions ?? [];
  if (list.length === 0) {
    return {
      candidateName: employee.fullName,
      unitName: employee.unitName,
      attempts: [],
      bestPercent: 0,
      passedCount: 0,
    };
  }

  const questionIds = [...new Set(list.flatMap((s) => s.question_ids as string[]))];
  const [{ data: questionRows }, { data: resultRows }, { data: quizRows }] = await Promise.all([
    supabaseAdmin.from("questions").select(QUESTION_COLUMNS).in("id", questionIds),
    supabaseAdmin
      .from("results")
      .select("session_id, score, total, time_seconds, time_ms, disqualified, submitted_at, quiz_title")
      .in(
        "session_id",
        list.map((s) => s.id),
      ),
    supabaseAdmin
      .from("quizzes")
      .select("id, title, pass_percent")
      .in("id", [...new Set(list.map((s) => s.quiz_id))]),
  ]);

  const questionById = new Map(
    ((questionRows ?? []) as unknown as QuestionRow[]).map((q) => [q.id, q]),
  );
  const resultBySession = new Map((resultRows ?? []).map((r) => [r.session_id, r]));
  const quizTitleById = new Map((quizRows ?? []).map((q) => [q.id, q.title]));
  // Mức đạt (phần trăm) của từng cuộc thi để tính "Đạt/Chưa đạt" thống nhất với lúc chấm bài.
  const passPercentById = new Map((quizRows ?? []).map((q) => [q.id, q.pass_percent]));

  const attempts: HistoryAttempt[] = list.map((s) => {
    const answers = (s.answers ?? {}) as Record<string, AnswerValue>;
    const orders = (s.option_orders as unknown as number[][]) ?? [];
    const result = resultBySession.get(s.id);

    const questions: HistoryQuestion[] = (s.question_ids as string[]).map((qid, idx) => {
      const row = questionById.get(qid);
      if (!row) {
        return {
          question: "(Câu hỏi đã bị xoá)",
          correct: false,
          answered: false,
          chosenText: null,
          correctText: "",
        };
      }
      const display = baseOptions(row);
      const order = orders[idx] ?? display.map((_, i) => i);
      const value = answers[String(idx)];
      const answered = value !== undefined && value !== null && value !== "";
      return {
        question: row.question,
        correct: gradeOne(row, order, value),
        answered,
        chosenText: answered ? chosenTextOf(row, order, value) : null,
        correctText: correctTextOf(row),
      };
    });

    const total = result?.total ?? (s.question_ids as string[]).length;
    const score = result?.score ?? questions.filter((q) => q.correct).length;
    const percent = percentOf(score, total);

    return {
      sessionId: s.id,
      quizTitle: result?.quiz_title || quizTitleById.get(s.quiz_id) || "Cuộc thi",
      startedAt: s.started_at,
      finishedAt: result?.submitted_at ?? s.submitted_at ?? null,
      status: (s.status as HistoryAttempt["status"]) ?? "submitted",
      score,
      total,
      percent,
      passed:
        !result?.disqualified &&
        isPassed(score, total, passPercentById.get(s.quiz_id) ?? PASS_PERCENT_DEFAULT),
      timeSeconds: result?.time_seconds ?? 0,
      timeMs: result?.time_ms ?? (result?.time_seconds ?? 0) * 1000,
      questions,
    };
  });

  const scored = attempts.filter((a) => a.status === "submitted");
  return {
    candidateName: employee.fullName,
    unitName: employee.unitName,
    attempts,
    bestPercent: scored.reduce((max, a) => Math.max(max, a.percent), 0),
    passedCount: scored.filter((a) => a.passed).length,
  };
}
