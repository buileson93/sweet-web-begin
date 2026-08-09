import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizeExamQuestion } from "@/lib/exam/clientPayload";
import type { Json } from "@/integrations/supabase/types";
import { mapStartExamError } from "@/lib/attempts";
import { deviceCooldownMessage } from "@/lib/deviceLock";
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
import { buildDeviceSnapshot, type ExamDeviceSnapshot } from "@/lib/exam/deviceSnapshot";
import { excludeRevealed, revealedFromSessions } from "@/lib/exam/revealGuard";


export type { ExamDeviceSnapshot };

/**
 * Thời gian nguội khi ĐỔI NGƯỜI THI trên cùng một thiết bị (phút).
 * Đây là biện pháp kỹ thuật chống thi hộ (không phạt ai cả): chính chủ thi
 * bao nhiêu lượt cũng được, chỉ khi chuyền máy sang nhân viên khác mới phải chờ.
 */
export const DEVICE_COOLDOWN_MINUTES = 120;

export async function startExamSession(input: {
  quizId: string;
  name: string;
  credential: string;
  extraCredential?: string;
  roomPassword?: string;
  deviceId?: string;
  captchaToken?: string;
  /** Thông tin thiết bị do máy khách gửi kèm. */
  device?: Record<string, unknown>;
  /** Thông tin máy chủ tự đọc từ request (IP, User-Agent). */
  request?: { ip?: string; ipSource?: string; userAgent?: string };
}): Promise<StartExamResult> {
  // Captcha vô hình Cloudflare Turnstile. Đề thường: chỉ lấy tín hiệu rủi ro để ghi
  // nhật ký liêm chính. Đề bật chế độ nghiêm ngặt: FAIL-CLOSED (kiểm tra ở dưới, sau
  // khi biết cờ strict_mode của đề) — thiếu token hoặc xác minh hỏng thì KHÔNG tạo phiên.
  const { verifyTurnstileToken } = await import("@/lib/turnstile.server");

  // Bắt buộc đối chiếu danh bạ nhân viên: sai thông tin thì không ghi nhận lượt thi.
  const employee = await verifyEmployee({
    name: input.name,
    credential: input.credential,
    extraCredential: input.extraCredential,
  });
  const name = employee.fullName;
  const birthYear = employee.birthYear;
  const unit = employee.unitName ?? "";

  // Chống thi hộ: một thiết bị chỉ phục vụ một nhân viên. Chính nhân viên đó
  // thi bao nhiêu lượt cũng được; đổi sang người khác phải chờ hết thời gian nguội.
  const deviceId = (input.deviceId ?? "").trim();
  if (deviceId.length >= 8) {
    const { data: claim, error: claimError } = await supabaseAdmin.rpc("claim_exam_device", {
      p_device_id: deviceId,
      p_employee_id: employee.id,
      p_candidate_name: name,
      p_cooldown_minutes: DEVICE_COOLDOWN_MINUTES,
    });
    if (claimError) throw new Error(claimError.message);
    const lock = claim?.[0];
    if (lock && lock.allowed === false) {
      throw new Error(deviceCooldownMessage(lock.wait_seconds ?? 0, lock.holder_name ?? ""));
    }
  }

  const { data: quiz, error: quizError } = await supabaseAdmin
    .from("quizzes")
    .select(QUIZ_COLUMNS)
    .eq("id", input.quizId)
    .maybeSingle();

  if (quizError) throw new Error(quizError.message);
  if (!quiz) throw new Error("Không tìm thấy cuộc thi.");
  if (!quiz.is_active) throw new Error("Cuộc thi này hiện đang tạm dừng.");
  if (quiz.status === "draft") throw new Error("Cuộc thi đang ở trạng thái nháp, chưa mở cho thí sinh.");
  // Cuộc thi tự mở/đóng theo mốc thời gian bên dưới; quản trị viên muốn dừng
  // khẩn cấp thì tắt công tắc "Đang hoạt động".

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

  // Đề nghiêm ngặt bắt buộc qua Turnstile mới được tạo phiên (không có đường "bỏ qua").
  const strict = quiz.strict_mode === true;
  const captcha = await verifyTurnstileToken(input.captchaToken, {
    action: "start-exam",
    required: strict,
  });
  if (strict && !captcha.ok) {
    throw new Error(
      "Không qua được xác minh chống script (" + captcha.reason + ") Vui lòng tải lại trang và thử lại.",
    );
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

  // Chống dò đáp án: câu nào đã bị "chấm ngay" ở phiên trước của chính thí sinh này
  // thì không phát lại ở phiên mới (miễn là ngân hàng còn đủ câu chưa lộ).
  // Nhờ vậy mở phiên nháp để soi đáp án rồi thoát ra sẽ không còn tác dụng.
  const { data: priorRaw } = await supabaseAdmin
    .from("exam_sessions")
    .select("question_ids, helpers, submitted_at")
    .eq("quiz_id", quiz.id)
    .eq("employee_id", employee.id)
    .order("started_at", { ascending: false })
    .limit(50);

  const revealed = revealedFromSessions(
    (priorRaw ?? []).map((s) => ({
      questionIds: (s.question_ids as string[]) ?? [],
      helpers: s.helpers,
      submitted: Boolean(s.submitted_at),
    })),
  );
  const usablePool = excludeRevealed(pool, revealed, wanted);

  const blueprint = (quiz.blueprint ?? {}) as Blueprint;
  // Cờ "Xáo trộn câu hỏi" quyết định thứ tự câu trong đề; tắt thì giữ order_index.
  const ordered = pickByBlueprint(usablePool, wanted, blueprint, quiz.shuffle_questions !== false);

  const settings: ExamSettings = {
    instantFeedback: quiz.instant_feedback ?? false,
    allowFiftyFifty: quiz.allow_fifty_fifty ?? false,
    allowSkip: quiz.allow_skip ?? false,
    streakBonus: quiz.streak_bonus ?? false,
    comboFx: quiz.combo_fx ?? true,
    showQuestionMap: quiz.show_question_map ?? true,
    passPercent: quiz.pass_percent ?? PASS_PERCENT_DEFAULT,
    strictMode: quiz.strict_mode ?? false,
  };



  const optionOrders: number[][] = [];
  const questions: ExamQuestion[] = ordered.map((q) => {
    const display = baseOptions(q);
    const displayImages = optionImagesOf(q);
    const indexes = display.map((_, i) => i);
    // Câu sắp xếp và nối cặp luôn trộn để tránh lộ thứ tự đúng.
    const mustShuffle = q.kind === "ordering" || q.kind === "matching";
    const order = quiz.shuffle_options || mustShuffle ? shuffle(indexes) : indexes;
    optionOrders.push(order);
    // sanitizeExamQuestion là chốt chặn cuối: chỉ các trường an toàn mới rời máy chủ.
    return sanitizeExamQuestion({
      id: q.id,
      kind: q.kind,
      question: q.question,
      options: permuteByOrder(display, order, ""),
      // Ảnh phương án phải hoán vị CÙNG một phép trộn, nếu không sẽ hiển thị sai/lộ đáp án.
      optionImages: permuteByOrder(displayImages, order, ""),
      matchLeft: q.kind === "matching" ? pairsOf(q).map((p) => p.left) : [],
      imageUrl: q.image_url ?? null,
      imageAlt: (q as { image_alt?: string }).image_alt ?? "",
      points: q.points || 1,
      difficulty: q.difficulty,
      timeLimitSeconds: q.time_limit_seconds ?? null,
    });
  });

  const expiresAt = new Date(now.getTime() + quiz.duration_minutes * 60_000);

  // Tạo snapshot trước khi mở phiên để database lưu cùng transaction. Như vậy
  // phiên không thể tồn tại với device_info rỗng do lệnh cập nhật thứ hai lỗi.
  const deviceSnapshot = buildDeviceSnapshot(input.device, input.request, now.toISOString());

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
    p_device_info: deviceSnapshot as unknown as Json,
  });

  if (sessionError) throw mapStartExamError(sessionError, maxAttempts);
  const session = created?.[0];
  if (!session) throw new Error("Không tạo được phiên thi. Vui lòng thử lại.");

  // Ghi nhật ký liêm chính (không chặn): captcha vô hình không qua.
  if (!captcha.ok && !captcha.skipped) {
    const { flagScriptEvent } = await import("@/lib/exam/scriptGuard.server");
    void flagScriptEvent(session.session_id, "captcha_failed", {
      source: "turnstile",
      signals: captcha.codes,
      note: captcha.reason,
    });
  }

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
      comboFx: quiz.combo_fx ?? true,
      showQuestionMap: quiz.show_question_map,
      passPercent: quiz.pass_percent || PASS_PERCENT_DEFAULT,
      strictMode: strict,
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
