import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { mapStartExamError } from "@/lib/attempts";
import { verifyEmployee } from "@/lib/employees.server";
import {
  PASS_PERCENT_DEFAULT,
  baseOptions,
  pairsOf,
  percentOf,
  optionImagesOf,
  permuteByOrder,
  pickByBlueprint,
  shuffle,
  type QuestionRow,
} from "@/lib/grading";
import { type Blueprint } from "@/lib/questionKinds";
import { submitExamSession } from "@/lib/exam/submit.server";
import {
  QUESTION_COLUMNS,
  QUIZ_COLUMNS,
  type ExamQuestion,
  type StartExamResult,
} from "@/lib/exam/types";

export async function startExamSession(input: {
  quizId: string;
  name: string;
  credential: string;
  extraCredential?: string;
  roomPassword?: string;
}): Promise<StartExamResult> {
  // Bắt buộc đối chiếu danh bạ nhân viên: sai thông tin thì không ghi nhận lượt thi.
  const employee = await verifyEmployee({
    name: input.name,
    credential: input.credential,
    extraCredential: input.extraCredential,
  });
  const name = employee.fullName;
  const birthYear = employee.birthYear;
  const unit = employee.unitName ?? "";

  const { data: quiz, error: quizError } = await supabaseAdmin
    .from("quizzes")
    .select(QUIZ_COLUMNS)
    .eq("id", input.quizId)
    .maybeSingle();

  if (quizError) throw new Error(quizError.message);
  if (!quiz) throw new Error("Không tìm thấy cuộc thi.");
  if (!quiz.is_active) throw new Error("Cuộc thi này hiện đang tạm dừng.");
  if (quiz.status === "draft") throw new Error("Cuộc thi đang ở trạng thái nháp, chưa mở cho thí sinh.");
  if (quiz.status === "closed") throw new Error("Cuộc thi đã đóng.");

  const now = new Date();
  if (quiz.start_time && now < new Date(quiz.start_time)) {
    throw new Error("Cuộc thi chưa đến giờ mở.");
  }
  if (quiz.end_time && now > new Date(quiz.end_time)) {
    throw new Error("Cuộc thi đã kết thúc.");
  }
  if (quiz.room_password && quiz.room_password !== (input.roomPassword ?? "")) {
    throw new Error("Mật khẩu phòng thi không đúng.");
  }

  // Đối tượng dự thi: để trống nghĩa là toàn công ty.
  const { data: audiences } = await supabaseAdmin
    .from("quiz_audiences")
    .select("units(name)")
    .eq("quiz_id", quiz.id);
  const allowedUnits = (audiences ?? [])
    .map((a) => (a as { units?: { name?: string } | null }).units?.name ?? "")
    .filter(Boolean);
  if (allowedUnits.length && !allowedUnits.includes(unit)) {
    throw new Error("Cuộc thi này chỉ dành cho: " + allowedUnits.join(", ") + ".");
  }

  // Khuyến khích thi lại nhiều lần: chỉ ghi nhận thành tích tốt nhất.
  // Việc đếm/khoá số lượt thi do hàm start_exam_session_tx đảm nhiệm (chống race condition).
  const { data: previous } = await supabaseAdmin
    .from("results")
    .select("score, total")
    .eq("quiz_id", quiz.id)
    .eq("employee_id", employee.id)
    .eq("disqualified", false);

  const bestPercent = (previous ?? []).reduce(
    (max, r) => Math.max(max, percentOf(r.score, r.total)),
    0,
  );

  const { data: poolRaw, error: poolError } = await supabaseAdmin
    .from("questions")
    .select(QUESTION_COLUMNS)
    .eq("quiz_id", quiz.id)
    .eq("is_archived", false)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (poolError) throw new Error(poolError.message);
  const pool = (poolRaw ?? []) as unknown as QuestionRow[];

  const wanted = Math.max(1, quiz.question_count);
  if (pool.length < wanted) {
    throw new Error(
      `Ngân hàng câu hỏi hiện có ${pool.length} câu, cần tối thiểu ${wanted} câu. Vui lòng báo quản trị viên bổ sung.`,
    );
  }

  const blueprint = (quiz.blueprint ?? {}) as Blueprint;
  // Cờ "Xáo trộn câu hỏi" quyết định thứ tự câu trong đề; tắt thì giữ order_index.
  const ordered = pickByBlueprint(pool, wanted, blueprint, quiz.shuffle_questions !== false);

  const optionOrders: number[][] = [];
  const questions: ExamQuestion[] = ordered.map((q) => {
    const display = baseOptions(q);
    const displayImages = optionImagesOf(q);
    const indexes = display.map((_, i) => i);
    // Câu sắp xếp và nối cặp luôn trộn để tránh lộ thứ tự đúng.
    const mustShuffle = q.kind === "ordering" || q.kind === "matching";
    const order = quiz.shuffle_options || mustShuffle ? shuffle(indexes) : indexes;
    optionOrders.push(order);
    return {
      id: q.id,
      kind: q.kind,
      question: q.question,
      options: permuteByOrder(display, order, ""),
      // Ảnh phương án phải hoán vị CÙNG một phép trộn, nếu không sẽ hiển thị sai/lộ đáp án.
      optionImages: permuteByOrder(displayImages, order, ""),
      matchLeft: q.kind === "matching" ? pairsOf(q).map((p) => p.left) : [],
      imageUrl: q.image_url ?? null,
      points: q.points || 1,
      difficulty: q.difficulty,
      timeLimitSeconds: q.time_limit_seconds ?? null,
    };
  });

  const expiresAt = new Date(now.getTime() + quiz.duration_minutes * 60_000);

  // Một transaction duy nhất: khoá theo (cuộc thi, nhân viên) → kiểm tra lượt thi
  // → huỷ phiên cũ → tạo phiên mới. Chạy song song cũng không tạo thừa lượt thi.
  const maxAttempts = quiz.max_attempts ?? 0;
  const { data: created, error: sessionError } = await supabaseAdmin.rpc("start_exam_session_tx", {
    p_quiz_id: quiz.id,
    p_employee_id: employee.id,
    p_max_attempts: maxAttempts,
    p_question_ids: ordered.map((q) => q.id),
    p_option_orders: optionOrders as unknown as Json,
    p_expires_at: expiresAt.toISOString(),
    p_candidate_name: name,
    p_birth_year: birthYear || "",
    p_unit: unit || "",
  });

  if (sessionError) throw mapStartExamError(sessionError, maxAttempts);
  const session = created?.[0];
  if (!session) throw new Error("Không tạo được phiên thi. Vui lòng thử lại.");

  return {
    sessionId: session.session_id,
    submitToken: session.submit_token,
    attempt: session.attempts + 1,

    bestPercent,
    candidateName: name,
    unit: unit || "Chưa cập nhật",
    quizTitle: quiz.title,
    durationMinutes: quiz.duration_minutes,
    expiresAt: expiresAt.toISOString(),
    serverNow: now.toISOString(),
    maxPoints: questions.reduce((sum, q) => sum + q.points, 0),
    settings: {
      instantFeedback: quiz.instant_feedback,
      allowFiftyFifty: quiz.allow_fifty_fifty,
      allowSkip: quiz.allow_skip,
      streakBonus: quiz.streak_bonus,
      showQuestionMap: quiz.show_question_map,
      passPercent: quiz.pass_percent || PASS_PERCENT_DEFAULT,
    },
    questions,
  };
}

/** Người thi chủ động thoát khỏi phòng thi (không tính điểm, không ghi bảng xếp hạng). */
export async function abandonExamSession(input: { sessionId: string; submitToken: string }) {
  const { error } = await supabaseAdmin
    .from("exam_sessions")
    .update({
      status: "abandoned",
      submitted_at: new Date().toISOString(),
      submit_token: crypto.randomUUID(),
    })
    .eq("id", input.sessionId)
    .eq("submit_token", input.submitToken)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return { ok: true };
}

/**
 * Dọn các phiên thi bị bỏ dở: quá hạn hơn 1 phút mà vẫn đang "active".
 * Chấm bằng ĐÁP ÁN ĐÃ LƯU trên máy chủ (submitExamSession sẽ tự bỏ qua đáp án máy khách vì đã quá ân hạn),
 * ghi results, chuyển status sang "submitted" và cấp submit_token mới.
 * An toàn khi chạy đồng thời: submitExamSession giành khoá bằng update ... eq("status", "active").
 */
export async function autoSubmitExpiredSessions(input?: {
  limit?: number;
}): Promise<{ found: number; submitted: number; failed: number }> {
  const limit = Math.max(1, Math.min(100, input?.limit ?? 100));
  const cutoff = new Date(Date.now() - 60_000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("exam_sessions")
    .select("id, submit_token")
    .eq("status", "active")
    .lt("expires_at", cutoff)
    .order("expires_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const sessions = data ?? [];
  let submitted = 0;
  let failed = 0;
  for (const session of sessions) {
    try {
      await submitExamSession({
        sessionId: session.id,
        submitToken: session.submit_token,
        answers: {},
      });
      submitted++;
    } catch (err) {
      // Một tiến trình khác có thể vừa chấm xong phiên này — bỏ qua, lần chạy sau sẽ không thấy nữa.
      failed++;
      console.error("autoSubmitExpiredSessions:", session.id, err);
    }
  }
  return { found: sessions.length, submitted, failed };
}
