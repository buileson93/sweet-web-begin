import type { FraudAttempt, FingerprintLog } from "./fraudTypes";

const MONITOR_ROLES = ["admin", "staff", "editor"] as const;

/** Kiểm tra quyền bằng MỘT truy vấn. */
export async function assertMonitorRole(supabase: {
  from: (t: string) => any;
}, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", MONITOR_ROLES as unknown as string[])
    .limit(1);
  if (error) throw new Error("Không kiểm tra được quyền theo dõi.");
  if (!data || data.length === 0) throw new Error("Tài khoản không có quyền xem báo cáo bảo mật.");
}

export async function fetchFraudReport(
  quizId?: string,
  minIntegrity: number = 95,
  limit: number = 100
): Promise<FraudAttempt[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin.rpc("get_fraud_report", {
    _quiz_id: quizId,
    _min_integrity: minIntegrity,
    _limit: limit
  });

  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    sessionId: row.session_id,
    candidateName: row.candidate_name,
    unit: row.unit || "",
    quizTitle: row.quiz_title,
    integrityScore: row.integrity_score,
    startedAt: row.started_at,
    fingerprint: row.fingerprint || "",
    deviceInfo: row.device_info,
    eventSummary: row.event_summary || {},
    riskLevel: row.risk_level as any,
    riskReason: row.risk_reason
  }));
}

export async function fetchAttemptEvents(sessionId: string): Promise<FingerprintLog[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("exam_events")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}
