import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { scoreEvent, type ExamEventDetail } from "@/lib/integrity";

/**
 * Ghi nhận vi phạm chống-script do CHÍNH máy chủ phát hiện (không phụ thuộc máy khách):
 * đáp án thiếu bằng chứng thao tác thật, nhịp trả lời máy móc, môi trường tự động hoá.
 * Cộng dồn vào điểm liêm chính — cuộc thi bật chế độ nghiêm ngặt sẽ tự huỷ bài khi chạm ngưỡng.
 */
export async function flagScriptEvent(
  sessionId: string,
  kind: "untrusted_input" | "script_suspect" | "automation_detected" | "honeypot_hit",
  detail: ExamEventDetail = {},
): Promise<void> {
  try {
    const REASON: Record<string, string> = {
      untrusted_input: "Đáp án gửi lên không kèm thao tác vật lý thật (isTrusted)",
      script_suspect: "Nhịp trả lời đều bất thường hoặc gói tin thiếu bằng chứng thao tác",
      automation_detected: "Môi trường trình duyệt bị điều khiển tự động",
      honeypot_hit: "Bấm vào phần tử mồi ẩn (honeypot)",
    };
    detail = { reason: REASON[kind], detectedAt: new Date().toISOString(), ...detail };
    const weight = scoreEvent(kind, detail);
    await supabaseAdmin.from("exam_events").insert({
      session_id: sessionId,
      kind,
      weight,
      detail: detail as never,
    });
    if (weight <= 0) return;
    const { data: row } = await supabaseAdmin
      .from("exam_sessions")
      .select("integrity_score")
      .eq("id", sessionId)
      .maybeSingle();
    await supabaseAdmin
      .from("exam_sessions")
      .update({ integrity_score: Number(row?.integrity_score ?? 0) + weight })
      .eq("id", sessionId);
  } catch {
    /* ghi nhận vi phạm không được phép làm hỏng luồng làm bài */
  }
}
