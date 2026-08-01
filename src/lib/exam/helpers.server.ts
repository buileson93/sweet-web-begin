import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  MAX_EVENTS_PER_SESSION,
  MAX_EXEMPT_EVENTS_PER_SESSION,
  QUOTA_EXEMPT_KINDS,
  isExamEventKind,
  isQuotaExempt,
  scoreEvent,
  type ExamEventDetail,
} from "@/lib/integrity";

import { lateness, shuffle, type QuestionRow } from "@/lib/grading";
import { QUESTION_COLUMNS } from "@/lib/exam/types";

/**
 * Trợ giúp 50:50 — máy chủ loại bớt 2 phương án sai (không bao giờ trả về đáp án đúng).
 * Chỉ áp dụng cho câu một đáp án / đúng-sai và chỉ khi cuộc thi bật tính năng này.
 */
export async function useFiftyFifty(input: {
  sessionId: string;
  submitToken: string;
  index: number;
}): Promise<{ removed: number[] }> {
  const { data: session } = await supabaseAdmin
    .from("exam_sessions")
    .select("id, quiz_id, question_ids, option_orders, status, submit_token, helpers, expires_at")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (!session || session.status !== "active" || session.submit_token !== input.submitToken) {
    throw new Error("Phiên thi không hợp lệ.");
  }
  // Khoá thời gian phía máy chủ: hết giờ thì không còn được dùng trợ giúp (không có ân hạn).
  if (lateness(new Date().toISOString(), session.expires_at).expired) {
    throw new Error("Đã hết giờ làm bài.");
  }

  const { data: quiz } = await supabaseAdmin
    .from("quizzes")
    .select("allow_fifty_fifty")
    .eq("id", session.quiz_id)
    .maybeSingle();
  if (!quiz?.allow_fifty_fifty) throw new Error("Cuộc thi này không bật trợ giúp 50:50.");

  const helpers = (session.helpers ?? {}) as Record<string, unknown>;
  const usedList = Array.isArray(helpers.fiftyFifty) ? (helpers.fiftyFifty as number[]) : [];
  if (usedList.length >= 2) throw new Error("Bạn đã dùng hết lượt trợ giúp 50:50.");

  const qid = (session.question_ids as string[])[input.index];
  const { data: rowRaw } = await supabaseAdmin
    .from("questions")
    .select(QUESTION_COLUMNS)
    .eq("id", qid)
    .maybeSingle();
  const row = rowRaw as unknown as QuestionRow | null;
  if (!row) throw new Error("Không tìm thấy câu hỏi.");
  if (row.kind !== "single" && row.kind !== "true_false")
    throw new Error("Câu hỏi này không hỗ trợ 50:50.");

  const order = ((session.option_orders as unknown as number[][]) ?? [])[input.index] ?? [];
  const wrong = order
    .map((orig, display) => ({ orig, display }))
    .filter((o) => o.orig !== row.correct_index);
  const removed = shuffle(wrong)
    .slice(0, Math.max(1, Math.min(2, wrong.length - 1)))
    .map((o) => o.display);

  await supabaseAdmin
    .from("exam_sessions")
    .update({ helpers: { ...helpers, fiftyFifty: [...usedList, input.index] } as never })
    .eq("id", session.id);

  return { removed };
}

/**
 * Vật phẩm X2 — nhân đôi điểm của MỘT câu (kể cả điểm thưởng combo đang có).
 * Mỗi lượt thi chỉ dùng được một lần và phải dùng TRƯỚC khi chốt đáp án câu đó.
 */
export async function useDoublePoints(input: {
  sessionId: string;
  submitToken: string;
  index: number;
}): Promise<{ index: number }> {
  const { data: session } = await supabaseAdmin
    .from("exam_sessions")
    .select("id, status, submit_token, helpers, answers, expires_at")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (!session || session.status !== "active" || session.submit_token !== input.submitToken) {
    throw new Error("Phiên thi không hợp lệ.");
  }
  if (lateness(new Date().toISOString(), session.expires_at).expired) {
    throw new Error("Đã hết giờ làm bài.");
  }

  const helpers = (session.helpers ?? {}) as Record<string, unknown>;
  const used = Array.isArray(helpers.x2) ? (helpers.x2 as number[]) : [];
  if (used.length >= 1) throw new Error("Bạn đã dùng hết lượt X2.");

  const answers = (session.answers ?? {}) as Record<string, unknown>;
  const answered = answers[String(input.index)];
  if (answered !== undefined && answered !== null && answered !== "") {
    throw new Error("Câu này đã trả lời, hãy dùng X2 trước khi chọn đáp án.");
  }

  await supabaseAdmin
    .from("exam_sessions")
    .update({ helpers: { ...helpers, x2: [input.index] } as never })
    .eq("id", session.id);

  return { index: input.index };
}

/**
 * Ghi nhận một sự kiện hành vi trong phòng thi và cộng dồn điểm liêm chính.
 * Không bao giờ tự huỷ bài ở đây — quyết định nằm ở lúc chấm bài (submitExamSession).
 */
export async function reportExamEvent(input: {
  sessionId: string;
  submitToken: string;
  kind: string;
  detail?: Record<string, unknown>;
}): Promise<{ ok: boolean; integrityScore: number }> {
  const { data: session } = await supabaseAdmin
    .from("exam_sessions")
    .select("id, submit_token, status, integrity_score")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (!session || session.submit_token !== input.submitToken || session.status !== "active")
    return { ok: false, integrityScore: session?.integrity_score ?? 0 };

  if (!isExamEventKind(input.kind))
    return { ok: false, integrityScore: session.integrity_score ?? 0 };

  // Chống spam theo NHÓM: các loại nặng (tab_hidden, multi_tab) có quota riêng rất rộng
  // để không bị "đốt" bởi việc bấm Ctrl+C liên tục đầu giờ.
  const exempt = isQuotaExempt(input.kind);
  let countQuery = supabaseAdmin
    .from("exam_events")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id);
  countQuery = exempt
    ? countQuery.in("kind", QUOTA_EXEMPT_KINDS as string[])
    : countQuery.not("kind", "in", `(${QUOTA_EXEMPT_KINDS.join(",")})`);
  const { count } = await countQuery;
  const limit = exempt ? MAX_EXEMPT_EVENTS_PER_SESSION : MAX_EVENTS_PER_SESSION;
  if ((count ?? 0) >= limit)
    return { ok: false, integrityScore: session.integrity_score ?? 0 };


  const detail = (input.detail ?? {}) as ExamEventDetail;
  const weight = scoreEvent(input.kind, detail);

  await supabaseAdmin.from("exam_events").insert({
    session_id: session.id,
    kind: input.kind,
    weight,
    detail: detail as never,
  });

  const next = (session.integrity_score ?? 0) + weight;
  if (weight > 0)
    await supabaseAdmin
      .from("exam_sessions")
      .update({ integrity_score: next })
      .eq("id", session.id);

  return { ok: true, integrityScore: next };
}
