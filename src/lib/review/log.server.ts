import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildReviewRows, type ReviewLogInput, type ReviewMode } from "@/lib/review/log";

/**
 * Ghi nhật ký ôn tập theo LÔ, một lệnh insert duy nhất.
 * Tuyệt đối không ném lỗi ra ngoài: luồng thi không bao giờ được hỏng vì ghi log.
 */
export async function logReviews(
  employeeId: string | null | undefined,
  mode: ReviewMode,
  items: ReviewLogInput[],
): Promise<void> {
  try {
    const rows = buildReviewRows(employeeId, mode, items);
    if (!rows.length) return;
    await supabaseAdmin.from("review_log").insert(rows as never);
  } catch {
    // nuốt im lặng — đây là dữ liệu phân tích, không phải dữ liệu thi
  }
}
