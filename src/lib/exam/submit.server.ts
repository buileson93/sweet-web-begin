import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DISQUALIFY_THRESHOLD_DEFAULT, shouldDisqualify, speedrunPenalty } from "@/lib/integrity";
import {
  PASS_PERCENT_DEFAULT,
  baseOptions,
  chosenTextOf,
  correctTextOf,
  gradeFraction,
  gradeOne,
  pairsOf,
  percentOf,
  isPassed,
  lateness,
  type QuestionRow,
  scoreForAnswer,
  reorderByDisplay,
  type ScoreRules,
} from "@/lib/grading";
import { type AnswerValue } from "@/lib/questionKinds";
import { computeXpGain, levelFromXp, levelProgress, levelTitle } from "@/lib/xp";
import { QUESTION_COLUMNS, type ReviewItem, type SubmitExamResult, type XpAward } from "@/lib/exam/types";


/** Chấm ngay một câu (chế độ phản hồi tức thì): chốt đáp án, trả kết quả đúng/sai. */
export async function checkExamAnswer(input: {
  sessionId: string;
  submitToken: string;
  index: number;
  value: AnswerValue;
}) {
  const { data: session, error } = await supabaseAdmin
    .from("exam_sessions")
    .select("id, question_ids, option_orders, status, submit_token, answers, expires_at")
    .eq("id", input.sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!session || session.status !== "active" || session.submit_token !== input.submitToken) {
    throw new Error("Phiên thi không hợp lệ.");
  }
  // Hết giờ thì dừng ghi nhận đáp án ngay, không có ân hạn cho thao tác trong phòng thi.
  if (lateness(new Date().toISOString(), session.expires_at).expired) {
    throw new Error("Đã hết giờ làm bài.");
  }
  const qid = (session.question_ids as string[])[input.index];
  if (!qid) throw new Error("Câu hỏi không tồn tại.");

  const { data: rowRaw } = await supabaseAdmin
    .from("questions")
    .select(QUESTION_COLUMNS)
    .eq("id", qid)
    .maybeSingle();
  const row = rowRaw as unknown as QuestionRow | null;
  if (!row) throw new Error("Câu hỏi không tồn tại.");

  const display = baseOptions(row);
  const orders = (session.option_orders as unknown as number[][]) ?? [];
  const order = orders[input.index] ?? display.map((_, i) => i);
  const correct = gradeOne(row, order, input.value);

  const answers = {
    ...((session.answers as Record<string, AnswerValue>) ?? {}),
    [String(input.index)]: input.value,
  };
  await supabaseAdmin
    .from("exam_sessions")
    .update({ answers: answers as never })
    .eq("id", session.id);

  return { correct, correctText: correctTextOf(row), explanation: row.explanation ?? "" };
}

export async function submitExamSession(input: {
  sessionId: string;
  submitToken: string;
  answers: Record<string, AnswerValue>;
  disqualified?: boolean;
  disqualifyReason?: string;
}): Promise<SubmitExamResult> {
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("exam_sessions")
    .select("*")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error("Phiên thi không tồn tại.");

  // Đã nộp rồi (bấm nộp hai lần, mạng chập chờn, hết giờ trùng lúc bấm nộp):
  // chấm lại từ đáp án đã lưu và trả về kết quả cũ thay vì báo lỗi.
  const alreadyDone = Boolean(session.submitted_at) || session.status !== "active";
  if (!alreadyDone && (!session.submit_token || session.submit_token !== input.submitToken)) {
    throw new Error("Mã nộp bài không hợp lệ. Vui lòng bắt đầu lượt thi mới.");
  }

  if (!alreadyDone) {
    const { data: locked, error: lockError } = await supabaseAdmin
      .from("exam_sessions")
      .update({ status: "grading" })
      .eq("id", session.id)
      .eq("submit_token", input.submitToken)
      .eq("status", "active")
      .select("id");
    if (lockError) throw new Error(lockError.message);
    if (!locked || locked.length === 0) {
      // Một tiến trình khác vừa chấm xong — đọc lại và trả kết quả đã có.
      const { data: fresh } = await supabaseAdmin
        .from("exam_sessions")
        .select("*")
        .eq("id", session.id)
        .maybeSingle();
      if (fresh) Object.assign(session, fresh);
    }
  }

  const replay = alreadyDone || session.status !== "active";
  const savedAnswers = (session.answers as Record<string, AnswerValue>) ?? {};
  // Khoá thời gian phía máy chủ: quá expires_at + ân hạn thì KHÔNG tin đáp án gửi từ máy khách nữa,
  // vì thí sinh có thể ngắt mạng, làm tiếp offline rồi mới nộp. Chỉ chấm những gì đã autosave
  // lên máy chủ trước khi hết giờ. Trong ân hạn (độ trễ mạng lúc bấm nộp) thì vẫn gộp bình thường.
  const late = lateness(new Date().toISOString(), session.expires_at);
  const lateSubmit = !replay && late.expired && !late.withinGrace;

  // Tải song song để rút ngắn thời gian chấm bài.
  const [quizRes, rowsRes, historyRes, existingRes] = await Promise.all([
    supabaseAdmin
      .from("quizzes")
      .select(
        "title, pass_percent, negative_marking, streak_bonus, streak_step, streak_max_bonus, double_points_after, strict_mode, disqualify_threshold, instant_feedback",
      )
      .eq("id", session.quiz_id)
      .maybeSingle(),
    supabaseAdmin.from("questions").select(QUESTION_COLUMNS).in("id", session.question_ids),
    supabaseAdmin
      .from("results")
      .select("score, total")
      .eq("quiz_id", session.quiz_id)
      .eq("employee_id", session.employee_id ?? "00000000-0000-0000-0000-000000000000")
      .eq("disqualified", false),
    supabaseAdmin
      .from("results")
      .select("id, disqualified, time_seconds")
      .eq("session_id", session.id)
      .maybeSingle(),
  ]);

  const quiz = quizRes.data;
  // Cuộc thi chấm ngay: đáp án đã CHỐT trên máy chủ là quyết định, máy khách không được ghi đè
  // (nếu không, có thể dò đáp án đúng qua chấm-ngay rồi nộp lại đáp án chuẩn).
  const answersToGrade =
    replay || lateSubmit
      ? (savedAnswers ?? input.answers)
      : quiz?.instant_feedback
        ? { ...input.answers, ...savedAnswers }
        : { ...savedAnswers, ...input.answers };

  if (rowsRes.error) throw new Error(rowsRes.error.message);
  const rows = (rowsRes.data ?? []) as unknown as QuestionRow[];
  const history = historyRes.data;
  const existing = existingRes.data;

  const byId = new Map(rows.map((r) => [r.id, r]));
  const orders = (session.option_orders as unknown as number[][]) ?? [];

  const scoreRules: ScoreRules = {
    streakBonus: quiz?.streak_bonus ?? true,
    streakStep: Number(quiz?.streak_step ?? 1),
    // 0 = combo luỹ tiến vô tận (không đặt trần điểm thưởng).
    streakMaxBonus: Number(quiz?.streak_max_bonus ?? 0),
    doublePointsAfter: Number(quiz?.double_points_after ?? 0),
    negativeMarking: Number(quiz?.negative_marking ?? 0),
  };

  /** Chỉ số câu đã dùng vật phẩm X2 (nhân đôi điểm câu đó). */
  const x2Set = new Set(
    Array.isArray((session.helpers as Record<string, unknown> | null)?.x2)
      ? (((session.helpers as Record<string, unknown>).x2 as unknown[]).map(Number) as number[])
      : [],
  );

  let score = 0;
  let points = 0;
  let streak = 0;
  let bestStreak = 0;
  const review: ReviewItem[] = [];
  const storedAnswers: Record<string, AnswerValue> = {};
  /** Dữ liệu tính độ khó thực tế của từng câu (chỉ ghi khi chấm lần đầu). */
  const statItems: { id: string; fraction: number; answered: boolean }[] = [];

  session.question_ids.forEach((qid: string, idx: number) => {
    const row = byId.get(qid);
    if (!row) return;
    const display = baseOptions(row);
    const order = orders[idx] ?? display.map((_, i) => i);
    const value = answersToGrade[String(idx)];
    const answered = value !== undefined && value !== null && value !== "";
    if (answered) storedAnswers[String(idx)] = value;

    const fraction = gradeFraction(row, order, value);
    const correct = fraction >= 1;
    statItems.push({ id: row.id, fraction, answered });

    if (correct) {
      score++;
      streak++;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
    }
    if (fraction > 0 && fraction < 1) {
      // Chấm điểm một phần (câu nhiều đáp án): không cộng chuỗi, không bị trừ điểm.
      points += Math.round((row.points || 1) * fraction * 100) / 100;
    } else {
      points += scoreForAnswer(row.points || 1, correct, answered, streak, scoreRules, {
        x2: x2Set.has(idx),
      });
    }

    review.push({
      kind: row.kind,
      question: row.question,
      options: order.map((i) => display[i]),
      matchLeft: row.kind === "matching" ? pairsOf(row).map((p) => p.left) : [],
      imageUrl: row.image_url ?? null,
      imageAlt: (row as { image_alt?: string }).image_alt ?? "",
      correct,
      fraction,
      answered,
      chosenText: chosenTextOf(row, order, value),
      correctText: correctTextOf(row),
      explanation: row.explanation ?? "",
      optionExplanations: reorderByDisplay(
        (row as { option_explanations?: string[] }).option_explanations,
        order,
      ),
      points: row.points || 1,
    });
  });

  const now = new Date();
  const startedAt = new Date(session.started_at);
  const expiresAt = new Date(session.expires_at);
  const endMoment = now > expiresAt ? expiresAt : now;
  const timeSeconds =
    replay && existing
      ? existing.time_seconds
      : Math.max(0, Math.round((endMoment.getTime() - startedAt.getTime()) / 1000));
  // Tương thích ngược: vẫn nhận input.disqualified nhưng CHỈ ghi lại như một gợi ý,
  // không dùng để quyết định kết quả (chặn request mạng không còn giúp thoát bị huỷ bài).
  if (!replay && input.disqualified) {
    await supabaseAdmin.from("exam_events").insert({
      session_id: session.id,
      kind: "tab_hidden",
      weight: 0,
      detail: { clientHint: true, reason: input.disqualifyReason ?? "" } as never,
    });
  }

  // Quyết định huỷ bài dựa trên điểm liêm chính do MÁY CHỦ tích luỹ.
  // Cộng thêm phạt "nộp nhanh bất thường" (dấu hiệu gửi đáp án bằng script).
  const answeredCount = Object.keys(storedAnswers).length;
  const speedPenalty = replay ? 0 : speedrunPenalty(timeSeconds, answeredCount);
  const integrityScore = Number(session.integrity_score ?? 0) + speedPenalty;
  const strictMode = Boolean(quiz?.strict_mode);
  const threshold = Number(quiz?.disqualify_threshold ?? DISQUALIFY_THRESHOLD_DEFAULT);
  // Nộp nhanh bất thường thì huỷ bài kể cả khi cuộc thi không bật chế độ nghiêm ngặt.
  const disqualified =
    replay && existing
      ? existing.disqualified
      : speedPenalty > 0 || shouldDisqualify(integrityScore, threshold, strictMode);
  /** Cờ cảnh báo cho quản trị khi không bật chế độ nghiêm ngặt nhưng điểm liêm chính đã chạm ngưỡng. */
  const integrityFlagged = !disqualified && integrityScore >= threshold;

  const total = session.question_ids.length;
  const finalScore = disqualified ? 0 : score;
  const finalPoints = disqualified ? 0 : Math.max(0, Math.round(points));
  const maxPoints = review.reduce((sum, r) => sum + r.points, 0);
  // Điểm đạt tính theo PHẦN TRĂM (0-100), không phải số câu đúng tuyệt đối.
  const passPercent = quiz?.pass_percent || PASS_PERCENT_DEFAULT;
  const passed = disqualified ? false : isPassed(finalScore, total, passPercent);

  const previousBestPercent = (history ?? []).reduce(
    (max, r) => Math.max(max, percentOf(r.score, r.total)),
    0,
  );

  let xpAward: XpAward | null = null;

  if (!replay) {

    await supabaseAdmin
      .from("exam_sessions")
      .update({
        submitted_at: now.toISOString(),
        status: disqualified ? "disqualified" : "submitted",
        answers: storedAnswers as never,
        best_streak: bestStreak,
        points: finalPoints,
        // Vô hiệu hoá mã nộp bài sau khi dùng.
        submit_token: crypto.randomUUID(),
      })
      .eq("id", session.id);

    const { error: insertError } = await supabaseAdmin.from("results").insert({
      session_id: session.id,
      quiz_id: session.quiz_id,
      quiz_title: quiz?.title ?? "",
      candidate_name: session.candidate_name,
      birth_year: session.birth_year,
      unit: session.unit,
      employee_id: session.employee_id,
      score: finalScore,
      total,
      points: finalPoints,
      max_points: maxPoints,
      best_streak: bestStreak,
      passed,
      time_seconds: timeSeconds,
      disqualified,
      integrity_score: integrityScore,
      late_submit: lateSubmit,
      disqualify_reason: lateSubmit
        ? "Nộp sau giờ"
        : disqualified
          ? `Vi phạm quy chế (điểm liêm chính ${integrityScore}/${threshold})`
          : integrityFlagged
            ? `Cảnh báo liêm chính ${integrityScore}/${threshold}`
            : null,
      submitted_at: now.toISOString(),
    });

    if (insertError && !insertError.message.includes("duplicate"))
      throw new Error(insertError.message);

    // Tích luỹ độ khó thực tế của từng câu hỏi (không chặn luồng trả kết quả).
    if (!disqualified && statItems.length) {
      await supabaseAdmin
        .rpc("bump_question_stats" as never, { p_items: statItems } as never)
        .then(() => undefined, () => undefined);
    }

    // Nhật ký ôn tập + lịch ôn cá nhân (Leo Tháp). Lỗi ở đây KHÔNG ảnh hưởng kết quả thi.
    if (!disqualified && statItems.length && session.employee_id) {
      const { logReviews } = await import("@/lib/review/log.server");
      const { applyReviewBatch } = await import("@/lib/tower/due.server");
      await logReviews(session.employee_id, "exam", statItems);
      await applyReviewBatch(
        session.employee_id,
        statItems.map((it) => ({ questionId: it.id, correct: it.answered && it.fraction >= 1 })),
      );
    }





    // Cộng kinh nghiệm / lên cấp cho nhân viên (Habitica style).
    if (session.employee_id) {
      const gain = computeXpGain({
        score: finalScore,
        total,
        passed,
        bestStreak,
        disqualified,
        improved: !disqualified && percentOf(finalScore, total) > previousBestPercent,
      });
      const { data: xpRow, error: xpErr } = await supabaseAdmin.rpc("award_player_xp", {
        p_employee_id: session.employee_id,
        p_display_name: session.candidate_name,
        p_unit: session.unit,
        p_gain: gain,
        p_passed: passed,
        p_best_streak: bestStreak,
      });
      if (!xpErr) {
        const row = Array.isArray(xpRow) ? xpRow[0] : xpRow;
        const newXp = Number(row?.xp ?? 0);
        const newLevel = Number(row?.level ?? 1);
        xpAward = {
          gained: Number(row?.gained ?? gain),
          xp: newXp,
          level: newLevel,
          leveledUp: newLevel > levelFromXp(Math.max(0, newXp - gain)),
          title: levelTitle(newLevel),
          ...(({ into, need, percent }) => ({ into, need, percent }))(levelProgress(newXp)),
        };
      }
    }
  }

  return {
    score: finalScore,
    total,
    points: finalPoints,
    maxPoints,
    bestStreak,
    passed,
    passPercent,
    timeSeconds,
    disqualified,
    quizId: session.quiz_id,
    quizTitle: quiz?.title ?? "",
    previousBestPercent,
    improved: !disqualified && percentOf(finalScore, total) > previousBestPercent,
    review,
    xp: xpAward,
  };

}

/**
 * Lưu tạm đáp án giữa giờ làm bài (autosave).
 * - Chỉ chấp nhận phiên còn "active", đúng submit_token và chưa quá expires_at.
 * - MERGE vào answers đã có trên máy chủ, không ghi đè toàn bộ.
 * - Chỉ nhận các chỉ số câu nằm trong question_ids của phiên.
 * - Chống ghi lùi bằng answers_seq: request có clientSeq <= answers_seq hiện tại sẽ bị bỏ qua.
 * KHÔNG trả về bất kỳ thông tin đúng/sai nào.
 */
export async function saveExamProgress(input: {
  sessionId: string;
  submitToken: string;
  answers: Record<string, AnswerValue>;
  clientSeq: number;
}): Promise<{ savedAt: string; seq: number }> {
  const { data: session, error } = await supabaseAdmin
    .from("exam_sessions")
    .select("id, question_ids, status, submit_token, answers, answers_seq, expires_at")
    .eq("id", input.sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!session || session.status !== "active" || session.submit_token !== input.submitToken) {
    throw new Error("Phiên thi không hợp lệ.");
  }
  // Hết giờ thì không nhận thêm đáp án nữa (không có ân hạn cho autosave).
  if (lateness(new Date().toISOString(), session.expires_at).expired) {
    throw new Error("Đã hết giờ làm bài.");
  }

  const currentSeq = Number(session.answers_seq ?? 0);
  const savedAnswers = (session.answers as Record<string, AnswerValue>) ?? {};
  // Gói tin đến muộn (seq nhỏ hơn hoặc bằng) bị bỏ qua để không ghi đè bản mới hơn.
  if (input.clientSeq <= currentSeq) {
    return { savedAt: new Date().toISOString(), seq: currentSeq };
  }

  const total = (session.question_ids as string[]).length;
  const incoming: Record<string, AnswerValue> = {};
  for (const [key, value] of Object.entries(input.answers ?? {})) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0 || idx >= total) continue;
    incoming[String(idx)] = value;
  }

  const merged = { ...savedAnswers, ...incoming };
  const { error: upErr } = await supabaseAdmin
    .from("exam_sessions")
    .update({ answers: merged as never, answers_seq: input.clientSeq })
    .eq("id", session.id)
    .eq("status", "active");
  if (upErr) throw new Error(upErr.message);

  return { savedAt: new Date().toISOString(), seq: input.clientSeq };
}

/** Đọc lại đáp án đã lưu trên máy chủ để hợp nhất khi thí sinh F5 / vào lại phòng thi. */
export async function getExamProgress(input: {
  sessionId: string;
  submitToken: string;
}): Promise<{ answers: Record<string, AnswerValue>; seq: number }> {
  const { data: session, error } = await supabaseAdmin
    .from("exam_sessions")
    .select("id, status, submit_token, answers, answers_seq")
    .eq("id", input.sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!session || session.status !== "active" || session.submit_token !== input.submitToken) {
    throw new Error("Phiên thi không hợp lệ.");
  }
  return {
    answers: (session.answers as Record<string, AnswerValue>) ?? {},
    seq: Number(session.answers_seq ?? 0),
  };
}
