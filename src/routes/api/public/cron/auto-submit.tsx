import { createFileRoute } from "@tanstack/react-router";

/**
 * Điểm cuối cho bộ đặt lịch: tự động nộp các phiên thi quá hạn còn bỏ dở.
 *
 * Bảo vệ bằng header bí mật `x-cron-secret`, đối chiếu với biến môi trường CRON_SECRET
 * (KHÔNG hardcode trong mã nguồn). Nếu chưa cấu hình CRON_SECRET thì điểm cuối bị khoá hoàn toàn.
 *
 * Cách đặt lịch chạy mỗi 5 phút:
 *
 * 1) Dùng pg_cron + pg_net (chạy ngay trên cơ sở dữ liệu):
 *
 *    select cron.schedule(
 *      'auto-submit-expired-exams',
 *      '＊/5 * * * *',
 *      $$
 *      select net.http_post(
 *        url := 'https://<địa-chỉ-ứng-dụng>/api/public/cron/auto-submit',
 *        headers := '{"Content-Type":"application/json","x-cron-secret":"<GIÁ_TRỊ_CRON_SECRET>"}'::jsonb,
 *        body := '{}'::jsonb
 *      ) as request_id;
 *      $$
 *    );
 *
 * 2) Hoặc dùng cron ngoài (GitHub Actions, cron-job.org, máy chủ nội bộ), mỗi 5 phút:
 *
 *    curl -X POST https://<địa-chỉ-ứng-dụng>/api/public/cron/auto-submit -H "x-cron-secret: $CRON_SECRET"
 */
export const Route = createFileRoute("/api/public/cron/auto-submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Đọc biến môi trường bên trong handler (môi trường được nạp theo từng request).
        const secret = process.env.CRON_SECRET;
        if (!secret) {
          return Response.json(
            { error: "Chưa cấu hình CRON_SECRET trên máy chủ." },
            { status: 503 },
          );
        }
        if (request.headers.get("x-cron-secret") !== secret) {
          return Response.json({ error: "Không có quyền." }, { status: 401 });
        }

        const { autoSubmitExpiredSessions } = await import("@/lib/exam.server");
        const result = await autoSubmitExpiredSessions({ limit: 100 });
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
