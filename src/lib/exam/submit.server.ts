import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkVerdict } from "@/lib/exam/clientPayload";
import { DISQUALIFY_THRESHOLD_DEFAULT, shouldDisqualify } from "@/lib/integrity";
import {
  MAX_NEW_ANSWERS_ON_SUBMIT,
  MAX_NEW_ANSWERS_PER_SAVE,
  limitNewAnswers,
} from "@/lib/exam/answerIntake";
import { auditSpeed, collectScriptSignals } from "@/lib/exam/speedAudit";


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
import { filterSavableAnswers, readCheckedIndexes } from "@/lib/exam/answerLock";
import { genesisHash, readChain, verifyChainLink } from "@/lib/exam/hashChain";
import { type SaveSource } from "@/lib/exam/saveRate";
import {
  checkMessage,
  saveMessage,
  signatureEnforced,
  staleProofKeys,
} from "@/lib/exam/payloadSign";

import { verifyPayloadSignature } from "@/lib/exam/payloadSign.server";
import { isRoboticTiming, unprovenKeys, type ProofLike } from "@/lib/exam/scriptDetect";
import { type RateVerdict } from "@/lib/exam/saveRate";




/** Chấm ngay một câu (chế độ phản hồi tức thì): chốt đáp án, trả kết quả đúng/sai. */
export async function checkExamAnswer(input: {
  sessionId: string;
  submitToken: string;
  index: number;
  value: AnswerValue;
  proof?: ProofLike;
  /** Chữ ký gói bằng khoá liveness của thiết bị đang thi. */
  signature?: string;
  /** Mốc thời gian máy khách (ms) đã được ký kèm. */
  at?: number;
}) {
  const { data: session, error } = await supabaseAdmin
    .from("exam_sessions")
    .select(
      "id, quiz_id, question_ids, option_orders, status, submit_token, answers, helpers, expires_at",
    )
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
  {
    const { isCaptchaLocked, CAPTCHA_LOCK_MESSAGE } = await import("@/lib/exam/captchaGuard.server");
    if (isCaptchaLocked(session.helpers as Record<string, unknown>)) {
      throw new Error(CAPTCHA_LOCK_MESSAGE);
    }
  }

  const qid = (session.question_ids as string[])[input.index];
  if (!qid) throw new Error("Câu hỏi không tồn tại.");

  // Chống dò đáp án bằng script: chấm-ngay chỉ phục vụ thao tác thật của thí sinh.
  // Fail-closed: thiếu bằng chứng cũng bị từ chối (trước đây bỏ trống là qua cửa).
  if (input.proof?.trusted !== true) {
    const { flagScriptEvent } = await import("@/lib/exam/scriptGuard.server");
    await flagScriptEvent(session.id, "untrusted_input", {
      source: "check",
      index: input.index,
    });
    throw new Error("Không ghi nhận được thao tác chọn đáp án. Vui lòng chọn lại trên màn hình.");
  }

  // Chỉ cuộc thi bật "chấm ngay" mới được trả đáp án đúng, và mỗi câu chỉ chốt MỘT lần —
  // nếu không, có thể gọi lặp nhiều phương án để dò toàn bộ đáp án rồi nộp bài trong vài giây.
  const { data: quizFlags } = await supabaseAdmin
    .from("quizzes")
    .select("instant_feedback, strict_mode")
    .eq("id", session.quiz_id)
    .maybeSingle();
  if (!quizFlags?.instant_feedback) throw new Error("Cuộc thi này không bật chấm ngay.");

  // Bắt buộc chữ ký theo TỪNG ĐỀ: đề bật chế độ nghiêm ngặt thì fail-closed ngay.
  const enforce = signatureEnforced(quizFlags?.strict_mode);

  // Chữ ký bằng khoá liveness (không xuất được) — script gọi API ngoài trang không tạo nổi.
  // Chữ ký bao trùm cả bằng chứng thao tác, và bằng chứng phải sát thời điểm gửi gói.
  {
    const stale = staleProofKeys(
      input.proof ? { [String(input.index)]: input.proof } : undefined,
      input.at,
    );
    const verdict = await verifyPayloadSignature({
      helpers: session.helpers,
      message: checkMessage({
        sessionId: session.id,
        index: input.index,
        value: input.value as unknown,
        proof: input.proof,
        at: Number(input.at ?? 0),
      }),
      signature: input.signature,
      at: input.at,
    });
    const failed = !verdict.ok || stale.length > 0;
    if (failed) {
      const { flagScriptEvent } = await import("@/lib/exam/scriptGuard.server");
      await flagScriptEvent(session.id, "script_suspect", {
        reason: verdict.ok ? "stale_proof_check" : "unsigned_check:" + verdict.reason,
        index: input.index,
        enforced: enforce,
      });
      if (enforce) {
        throw new Error("Gói chấm điểm không hợp lệ. Vui lòng tải lại phòng thi.");
      }
    }
  }

  const savedSoFar = (session.answers as Record<string, AnswerValue>) ?? {};
  // Danh sách CHỐT nằm riêng trong helpers.checked: autosave không thể chạm vào,
  // nên không thể "ghi thử từng phương án rồi hỏi đúng/sai" để dò đáp án.
  const checked = readCheckedIndexes(session.helpers);
  const locked = checked.includes(input.index);

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
  // Câu đã chốt thì luôn chấm lại theo đáp án ĐÃ LƯU, không theo giá trị vừa gửi lên.
  // Nhờ vậy tải lại trang vẫn xem được phản hồi cũ, còn script thì không dò được gì mới.
  const graded = locked ? (savedSoFar[String(input.index)] as AnswerValue) : input.value;
  const correct = gradeOne(row, order, graded);

  if (!locked) {
    // Ghi NGUYÊN TỬ: không đọc-rồi-ghi cả cột nên request song song không ghi đè mất nhau.
    const { applyAnswersAtomic, markCheckedIndex } = await import(
      "@/lib/exam/helpersWrite.server"
    );

    // Giải mã hashed value nếu có
    let finalValue = input.value;
    if (typeof input.value === "string" && input.value.startsWith("h:")) {
      const parts = input.value.split(":");
      // parts[0] = 'h', parts[1] = clientSecret, parts[2] = actualValue
      // Máy chủ tin tưởng clientSecret từ máy khách vì nó đã được ký trong payload
      if (parts.length >= 3) {
        const raw = parts.slice(2).join(":");
        finalValue = isNaN(Number(raw)) ? raw : Number(raw);
      }
    }

    await applyAnswersAtomic({
      sessionId: session.id,
      answers: { [String(input.index)]: finalValue as AnswerValue },
      seq: 0,
      helpersPatch: {},
    });
    await markCheckedIndex(session.id, input.index);
  }



  // CHỈ trả về đúng/sai. Nội dung đáp án đúng và lời giải KHÔNG bao giờ đi xuống
  // máy khách trong lúc đang thi — mọi việc chấm nằm ở máy chủ, nên dù mở console
  // hay chặn gói tin cũng không đọc được đáp án. Xem lại đầy đủ ở phần kết quả sau khi nộp.
  return { ...checkVerdict(correct), correctText: "", explanation: "" };
}



export async function submitExamSession(input: {
  sessionId: string;
  submitToken: string;
  answers: Record<string, AnswerValue>;
  proofs?: Record<string, ProofLike>;
  disqualified?: boolean;
  disqualifyReason?: string;
  clientSecret?: string;
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
      .select("id, disqualified, time_seconds, time_ms")
      .eq("session_id", session.id)
      .maybeSingle(),
  ]);

  const quiz = quizRes.data;
  // Máy chủ chỉ chấm đáp án đã lưu qua tiến trình làm bài; request nộp bài chỉ được
  // kèm thêm tối đa MAX_NEW_ANSWERS_ON_SUBMIT câu MỚI (phần đuôi chưa kịp autosave).
  // Nhờ vậy không thể gửi trọn bộ đáp án bằng một request duy nhất, mà cũng không
  // phạt oan ai cả — phần vượt trần chỉ bị bỏ qua.
  const guarded = replay
    ? { kept: input.answers ?? {} }
    : await guardProofs({
        sessionId: session.id,
        saved: savedAnswers,
        incoming: input.answers ?? {},
        proofs: input.proofs,
      });
  const clientAnswers = limitNewAnswers(savedAnswers, guarded.kept, MAX_NEW_ANSWERS_ON_SUBMIT);
  // Cuộc thi chấm ngay: đáp án đã CHỐT trên máy chủ là quyết định, máy khách không được ghi đè
  // (nếu không, có thể dò đáp án đúng qua chấm-ngay rồi nộp lại đáp án chuẩn).
  const answersToGrade =
    replay || lateSubmit
      ? (savedAnswers ?? input.answers)
      : quiz?.instant_feedback
        ? { ...clientAnswers, ...savedAnswers }
        : { ...savedAnswers, ...clientAnswers };


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
  const elapsedMs = Math.max(0, endMoment.getTime() - startedAt.getTime());
  const timeMs =
    replay && existing ? ((existing as { time_ms?: number | null }).time_ms ?? existing.time_seconds * 1000) : elapsedMs;
  const timeSeconds = replay && existing ? existing.time_seconds : Math.round(elapsedMs / 1000);
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

  // Phân tích hành vi nâng cao: pixel-perfect click và robotic trajectory
  if (!replay) {
    const helpers = session.helpers as Record<string, any>;
    const behaviorSignals = (helpers?.behavior?.signals as string[]) || [];
    if (behaviorSignals.includes("pixel_perfect_clicks")) {
      const { flagScriptEvent } = await import("@/lib/exam/scriptGuard.server");
      await flagScriptEvent(session.id, "unnatural_click", {
        reason: "pixel_perfect_clicks",
        source: "submit",
      });
    }
    if (behaviorSignals.includes("robotic_trajectory")) {
      const { flagScriptEvent } = await import("@/lib/exam/scriptGuard.server");
      await flagScriptEvent(session.id, "robotic_movement", {
        reason: "robotic_trajectory",
        source: "submit",
      });
    }
  }

  // Luật tốc độ: chỉ phạt khi NHANH TỚI MỨC BẤT KHẢ THI, hoặc nhanh bất thường
  // đi kèm tín hiệu script (mở console, gọi API thô, lưu bài dồn dập...).
  // Thi nhanh thật với ít câu hoặc điểm thấp vẫn KHÔNG bị phạt.
  let speedWeight = 0;
  if (!replay) {
    const { data: pastEvents } = await supabaseAdmin
      .from("exam_events")
      .select("kind, detail")
      .eq("session_id", session.id)
      .limit(200);
    const signals = collectScriptSignals(
      (pastEvents ?? []) as { kind: string; detail?: unknown }[],
    );
    const answeredCount = review.filter((r) => r.answered).length;
    const correctCount = review.filter((r) => r.correct).length;
    const audit = auditSpeed({
      answered: answeredCount,
      correct: correctCount,
      seconds: timeSeconds,
      signals,
    });
    if (audit.reason) {
      const { flagScriptEvent } = await import("@/lib/exam/scriptGuard.server");
      await flagScriptEvent(session.id, "speed_anomaly", {
        reason: audit.reason,
        weight: audit.weight,
        secPerQuestion: Math.round(audit.secPerQuestion * 100) / 100,
        accuracy: Math.round(audit.accuracy * 100) / 100,
        answered: answeredCount,
        correct: correctCount,
        seconds: timeSeconds,
        signals,
      });
      speedWeight = audit.weight;
    }
  }

  // Quyết định huỷ bài dựa trên điểm liêm chính do MÁY CHỦ tích luỹ từ sự kiện hành vi
  // (đã gồm mức phạt tốc độ vừa tính ở trên).
  const integrityScore = Number(session.integrity_score ?? 0) + speedWeight;
  const strictMode = Boolean(quiz?.strict_mode);
  const threshold = Number(quiz?.disqualify_threshold ?? DISQUALIFY_THRESHOLD_DEFAULT);
  const disqualified =
    replay && existing
      ? existing.disqualified
      : shouldDisqualify(integrityScore, threshold, strictMode);


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
      time_ms: timeMs,
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
    timeMs,
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
  proofs?: Record<string, ProofLike>;
  clientSeq: number;
  chainPrev?: string;
  chainHash?: string;
  /** Chữ ký gói bằng khoá liveness của thiết bị đang thi. */
  signature?: string;
  /** Mốc thời gian máy khách (ms) đã được ký kèm — chống phát lại. */
  at?: number;
  /** Nguồn gửi: RPC bình thường hay sendBeacon lúc tab bị ẩn. */
  source?: SaveSource;
  /** Bản vá helpers (ví dụ: thông tin sinh trắc học hành vi). */
  helpersPatch?: Record<string, unknown>;
  clientSecret?: string;
}): Promise<{
  savedAt: string;
  seq: number;
  accepted: string[];
  chainHead: string;
  rejected?: "chain" | "rate" | "signature";
}> {
  const { data: session, error } = await supabaseAdmin
    .from("exam_sessions")
    .select(
      "id, quiz_id, question_ids, status, submit_token, answers, helpers, answers_seq, expires_at",
    )
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
  {
    const { isCaptchaLocked, CAPTCHA_LOCK_MESSAGE } = await import("@/lib/exam/captchaGuard.server");
    if (isCaptchaLocked(session.helpers as Record<string, unknown>)) {
      throw new Error(CAPTCHA_LOCK_MESSAGE);
    }
  }


  const currentSeq = Number(session.answers_seq ?? 0);
  const savedAnswers = (session.answers as Record<string, AnswerValue>) ?? {};
  const chain = readChain(session.helpers);
  const expectedHead = chain?.head ?? (await genesisHash(session.id));
  // Gói tin đến muộn (seq nhỏ hơn hoặc bằng) bị bỏ qua để không ghi đè bản mới hơn.
  if (input.clientSeq <= currentSeq) {
    return {
      savedAt: new Date().toISOString(),
      seq: currentSeq,
      accepted: [],
      chainHead: expectedHead,
    };
  }

  // Bắt buộc chữ ký / bằng chứng theo TỪNG ĐỀ THI (đề bật chế độ nghiêm ngặt).
  const { data: quizFlags } = await supabaseAdmin
    .from("quizzes")
    .select("strict_mode")
    .eq("id", session.quiz_id)
    .maybeSingle();
  const enforceSignature = signatureEnforced(quizFlags?.strict_mode);

  // Trần tần suất phía máy chủ: chặn script bắn liên tục hàng chục gói mỗi giây,
  // đồng thời chặn phát lại đúng một gói đã ký (theo dấu vân tay chữ ký).
  // Kiểm tra + cập nhật diễn ra NGUYÊN TỬ trong một hàm SQL có khoá hàng,
  // nên nhiều request bắn song song không còn lách được giới hạn.
  const nowMs = Date.now();
  const source: SaveSource = input.source === "beacon" ? "beacon" : "rpc";
  const { claimSaveSlot } = await import("@/lib/exam/helpersWrite.server");
  const rateVerdict = await claimSaveSlot({
    sessionId: session.id,
    nowMs,
    source,
    signature: input.signature,
  });
  if (!rateVerdict.ok) {
    const { flagScriptEvent } = await import("@/lib/exam/scriptGuard.server");
    await flagScriptEvent(session.id, "script_suspect", {
      reason: "autosave_rate:" + rateVerdict.reason,
      source,
    });
    return {
      savedAt: new Date().toISOString(),
      seq: currentSeq,
      accepted: [],
      chainHead: expectedHead,
      rejected: "rate",
    };
  }

  // Nếu nhịp độ đáng ngờ (Rolling Window), ghi log nhưng không chặn (Adaptive Monitoring)
  if (rateVerdict.suspicious) {
    const { flagScriptEvent } = await import("@/lib/exam/scriptGuard.server");
    await flagScriptEvent(session.id, "script_suspect", {
      reason: "robotic_timing_rolling",
      source,
    });
  }

  // Chuỗi băm: gói này phải nối tiếp đúng mắt xích máy chủ đã xác nhận ở gói trước.
  // Gói gửi lại (replay) hoặc ghép từ nhiều gói bắt được sẽ gãy chuỗi và bị bỏ qua
  // (không ghi gì cả) — máy khách nhận lại chainHead thật để đồng bộ và gửi lại đúng thứ tự.
  const check = await verifyChainLink({
    expectedHead,
    established: Boolean(chain),
    seq: input.clientSeq,
    delta: input.answers ?? {},
    chainPrev: input.chainPrev,
    chainHash: input.chainHash,
  });
  if (!check.ok) {
    return {
      savedAt: new Date().toISOString(),
      seq: currentSeq,
      accepted: [],
      chainHead: expectedHead,
      rejected: "chain",
    };
  }

  // Chữ ký bằng khoá liveness: bằng chứng gói được tạo TRONG trang thi trên chính
  // thiết bị đã đăng ký khoá, không phải bởi curl/Postman/headless gọi thẳng API.
  // Chữ ký bao trùm CẢ phần bằng chứng thao tác (proofs) nên không thể sửa cờ `trusted`.
  const sigVerdict = await verifyPayloadSignature({
    helpers: session.helpers,
    message: saveMessage({
      sessionId: session.id,
      seq: input.clientSeq,
      chainPrev: expectedHead,
      delta: input.answers ?? {},
      proofs: input.proofs,
      at: Number(input.at ?? 0),
    }),
    signature: input.signature,
    at: input.at,
    nowMs,
  });
  if (!sigVerdict.ok) {
    const { flagScriptEvent } = await import("@/lib/exam/scriptGuard.server");
    await flagScriptEvent(session.id, "script_suspect", {
      reason: "unsigned_payload:" + sigVerdict.reason,
      source,
      enforced: enforceSignature,
    });
    if (enforceSignature) {
      return {
        savedAt: new Date().toISOString(),
        seq: currentSeq,
        accepted: [],
        chainHead: expectedHead,
        rejected: "signature",
      };
    }
  }

  const total = (session.question_ids as string[]).length;
  const incoming: Record<string, AnswerValue> = {};
  for (const [key, value] of Object.entries(input.answers ?? {})) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0 || idx >= total) continue;
    incoming[String(idx)] = value;
  }

  // Câu đã chốt bằng chấm-ngay thì autosave KHÔNG được ghi đè: nếu không, có thể
  // ghi thử từng phương án rồi hỏi chấm-ngay để dò ra đáp án đúng của mọi câu.
  const savable = filterSavableAnswers(incoming, readCheckedIndexes(session.helpers));

  // Bằng chứng thao tác phải SÁT thời điểm gói được gửi: bằng chứng cũ (bắt lại từ gói trước)
  // bị hạ xuống "không có bằng chứng" thay vì được tính là thao tác thật.
  const stale = staleProofKeys(input.proofs, input.at);
  const proofs = input.proofs
    ? Object.fromEntries(
        Object.entries(input.proofs).map(([key, p]) =>
          stale.includes(key) ? [key, { ...p, trusted: false, via: "none" as const }] : [key, p],
        ),
      )
    : undefined;
  if (stale.length > 0) {
    const { flagScriptEvent } = await import("@/lib/exam/scriptGuard.server");
    await flagScriptEvent(session.id, "script_suspect", {
      reason: "stale_proof",
      indexes: stale.slice(0, 20),
      source,
    });
  }

  // CHỐNG SCRIPT: mỗi câu MỚI phải kèm bằng chứng thao tác vật lý thật (sự kiện isTrusted).
  // Script gọi thẳng API hoặc bắn sự kiện giả không thể tạo ra bằng chứng này.
  const { kept, flags } = await guardProofs({
    sessionId: session.id,
    saved: savedAnswers,
    incoming: savable,
    ...(proofs ? { proofs } : {}),
    strict: enforceSignature,
  });
  void flags;
  // Trần số câu MỚI cho mỗi lần lưu: người thi thật lưu theo nhịp nên không bao giờ chạm,
  // còn script không thể nhồi cả bài trong một request. Sửa câu đã lưu vẫn tự do.
  const accepted = limitNewAnswers(savedAnswers, kept, MAX_NEW_ANSWERS_PER_SAVE);

  // Ghi NGUYÊN TỬ: chỉ gửi phần vá (đáp án mới + mắt xích chuỗi băm), không ghi đè cả cột.
  const { applyAnswersAtomic } = await import("@/lib/exam/helpersWrite.server");

  // Giải mã hashed values trong accepted delta nếu có clientSecret
  const finalAccepted: Record<string, AnswerValue> = {};
  for (const [key, value] of Object.entries(accepted)) {
    if (input.clientSecret && typeof value === "string" && value.startsWith(`h:${input.clientSecret}:`)) {
      const raw = value.slice(input.clientSecret.length + 3);
      finalAccepted[key] = isNaN(Number(raw)) ? raw : Number(raw);
    } else {
      finalAccepted[key] = value;
    }
  }

  await applyAnswersAtomic({
    sessionId: session.id,
    answers: finalAccepted,
    seq: input.clientSeq,
    helpersPatch: { 
      chain: { head: check.head, seq: input.clientSeq },
      ...(input.helpersPatch ?? {}),
    },
  });


  // Trả về danh sách câu THỰC SỰ được ghi để máy khách chỉ đánh dấu đã lưu phần đó
  // và tự gửi lại phần còn thừa ở lần lưu kế tiếp (không mất đáp án khi mất mạng lâu).
  return {
    savedAt: new Date().toISOString(),
    seq: input.clientSeq,
    accepted: Object.keys(accepted),
    chainHead: check.head,
  };
}

/** Đọc lại đáp án đã lưu trên máy chủ để hợp nhất khi thí sinh F5 / vào lại phòng thi. */
export async function getExamProgress(input: {
  sessionId: string;
  submitToken: string;
}): Promise<{ answers: Record<string, AnswerValue>; seq: number; chainHead: string }> {
  const { data: session, error } = await supabaseAdmin
    .from("exam_sessions")
    .select("id, status, submit_token, answers, answers_seq, helpers")
    .eq("id", input.sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!session || session.status !== "active" || session.submit_token !== input.submitToken) {
    throw new Error("Phiên thi không hợp lệ.");
  }
  const chain = readChain(session.helpers);
  return {
    answers: (session.answers as Record<string, AnswerValue>) ?? {},
    seq: Number(session.answers_seq ?? 0),
    chainHead: chain?.head ?? (await genesisHash(session.id)),
  };
}

/**
 * Cửa kiểm tra "bằng chứng thao tác thật" cho các câu MỚI.
 * - Câu mới không có bằng chứng => KHÔNG ghi vào bài làm và bị ghi nhận vi phạm.
 * - Gói tin không kèm bằng chứng nào (máy khách cũ / gọi API thô) => vẫn ghi nhưng bị cảnh báo.
 * - Nhịp trả lời đều như máy => ghi nhận cảnh báo script.
 * Sửa lại câu đã lưu không bị ảnh hưởng (không phạt oan người thi sửa đáp án).
 */
async function guardProofs(args: {
  sessionId: string;
  saved: Record<string, AnswerValue>;
  incoming: Record<string, AnswerValue>;
  proofs?: Record<string, ProofLike>;
  /** Giai đoạn chặn thật: câu MỚI không có bằng chứng thì KHÔNG ghi. */
  strict?: boolean;
}): Promise<{ kept: Record<string, AnswerValue>; flags: string[] }> {
  const { flagScriptEvent } = await import("@/lib/exam/scriptGuard.server");
  const newKeys = Object.keys(args.incoming).filter(
    (key) => !Object.prototype.hasOwnProperty.call(args.saved, key),
  );
  const flags: string[] = [];

  if (newKeys.length === 0) return { kept: args.incoming, flags };

  if (!args.proofs) {
    await flagScriptEvent(args.sessionId, "script_suspect", {
      reason: "no_proof_payload",
      count: newKeys.length,
    });
    if (!args.strict) return { kept: args.incoming, flags: ["no_proof_payload"] };
    // Fail-closed: bỏ hẳn các câu mới không kèm bằng chứng, giữ nguyên phần sửa câu cũ.
    const keptOld: Record<string, AnswerValue> = {};
    for (const [key, value] of Object.entries(args.incoming)) {
      if (!newKeys.includes(key)) keptOld[key] = value;
    }
    return { kept: keptOld, flags: ["no_proof_payload"] };
  }

  const bad = unprovenKeys(newKeys, args.proofs);
  const kept: Record<string, AnswerValue> = {};
  for (const [key, value] of Object.entries(args.incoming)) {
    if (!bad.includes(key)) kept[key] = value;
  }
  if (bad.length > 0) {
    flags.push("untrusted_input");
    await flagScriptEvent(args.sessionId, "untrusted_input", {
      indexes: bad.slice(0, 20),
      count: bad.length,
    });
  }

  const stamps = newKeys
    .map((key) => Number(args.proofs?.[key]?.at ?? NaN))
    .filter((n) => Number.isFinite(n));
  if (isRoboticTiming(stamps)) {
    flags.push("robotic_timing");
    await flagScriptEvent(args.sessionId, "script_suspect", { reason: "robotic_timing" });
  }

  return { kept, flags };
}
