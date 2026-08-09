/**
 * Ghi trạng thái vào cột `helpers` (jsonb) một cách NGUYÊN TỬ ở phía máy chủ.
 *
 * Vì sao: trước đây mọi nhánh (`save`, `chain`, `checked`, `liveness.jwk`, `x2`...)
 * đều đọc cả cột rồi ghi đè cả cột. Hai request song song sẽ ghi đè lẫn nhau:
 * script bắn nhiều gói cùng lúc có thể lách trần tần suất, và tệ hơn là làm mất
 * dữ liệu của thí sinh (mắt xích chuỗi băm, danh sách câu đã chốt).
 *
 * Ở đây mọi thay đổi đi qua hàm SQL khoá hàng (`... FOR UPDATE` / UPDATE một câu lệnh),
 * chỉ gửi lên PHẦN VÁ (patch) chứ không gửi cả cột.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AnswerValue } from "@/lib/questionKinds";
import {
  MAX_BEACONS_PER_SESSION,
  MAX_SAVES_PER_SESSION,
  MIN_GAP_BEACON_MS,
  MIN_GAP_RPC_MS,
  SEEN_LIMIT,
  fingerprint,
  type RateVerdict,
  type SaveSource,
} from "@/lib/exam/saveRate";

/** Gộp một phần vá vào helpers (nguyên tử, không mất nhánh khác). */
export async function mergeHelpers(
  sessionId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await supabaseAdmin.rpc("exam_merge_helpers" as never, {
    p_session: sessionId,
    p_patch: patch,
  } as never);
}

/** Thêm một chỉ số vào danh sách câu đã chốt (chấm ngay) — nguyên tử. */
export async function markCheckedIndex(sessionId: string, index: number): Promise<void> {
  await supabaseAdmin.rpc("exam_mark_checked" as never, {
    p_session: sessionId,
    p_index: index,
  } as never);
}

/**
 * Xin "suất" cho một gói autosave: kiểm tra trần tần suất và cập nhật trạng thái
 * trong CÙNG một giao dịch có khoá hàng, nên nhiều request song song không lách được.
 */
export async function claimSaveSlot(params: {
  sessionId: string;
  nowMs: number;
  source: SaveSource;
  signature?: string | undefined;
}): Promise<RateVerdict> {
  const { sessionId, nowMs, source, signature } = params;
  const { data, error } = await supabaseAdmin.rpc("exam_claim_save" as never, {
    p_session: sessionId,
    p_now_ms: nowMs,
    p_source: source,
    p_fingerprint: signature ? fingerprint(signature) : "",
    p_min_gap: source === "beacon" ? MIN_GAP_BEACON_MS : MIN_GAP_RPC_MS,
    p_max_saves: MAX_SAVES_PER_SESSION,
    p_max_beacons: MAX_BEACONS_PER_SESSION,
    p_seen_limit: SEEN_LIMIT,
  } as never);
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as
    | { ok?: boolean; reason?: string; suspicious?: boolean }
    | null
    | undefined;
  if (row?.ok) return { ok: true, suspicious: row.suspicious };
  const reason = row?.reason;
  if (reason === "too_fast" || reason === "too_many" || reason === "too_many_beacons" || reason === "replay") {
    return { ok: false, reason };
  }
  return { ok: false, reason: "too_fast" };
}

/** Ghi đáp án + seq + phần vá helpers trong MỘT câu lệnh (không đọc-rồi-ghi). */
export async function applyAnswersAtomic(params: {
  sessionId: string;
  answers: Record<string, AnswerValue>;
  seq: number;
  helpersPatch: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin.rpc("exam_apply_answers" as never, {
    p_session: params.sessionId,
    p_answers: params.answers,
    p_seq: params.seq,
    p_helpers: params.helpersPatch,
  } as never);
  if (error) throw new Error(error.message);
}
