/**
 * Xác thực yêu cầu đến từ bộ đặt lịch (pg_cron) cho các điểm cuối /api/public/cron/*.
 *
 * Khoá bí mật KHÔNG nằm trong mã nguồn: nó được sinh ngẫu nhiên và lưu trong kho
 * cấu hình nội bộ của cơ sở dữ liệu (schema `private`, không mở qua Data API).
 * Ứng dụng đối chiếu bằng hàm `public.verify_cron_secret` (chỉ service_role gọi được).
 *
 * Vẫn chấp nhận biến môi trường CRON_SECRET để chạy thử ở máy cá nhân.
 */
export async function verifyCronRequest(request: Request): Promise<boolean> {
  const provided = request.headers.get("x-cron-secret") ?? "";
  if (!provided) return false;

  const envSecret = process.env.CRON_SECRET;
  if (envSecret && provided === envSecret) return true;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("verify_cron_secret", { p_secret: provided });
  if (error) {
    console.error("[cron] Không kiểm tra được khoá bí mật:", error.message);
    return false;
  }
  return data === true;
}
