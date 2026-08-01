import { createFileRoute } from "@tanstack/react-router";

/**
 * Điểm cuối cho bộ đặt lịch: dọn ảnh câu hỏi không dùng.
 *
 * - Xoá mọi tệp trong `tmp/` cũ hơn 24 giờ (ảnh dán vào rồi đóng hộp thoại, hỏng mạng...).
 * - Xoá mọi tệp không được bất kỳ dòng `questions.image_url` nào tham chiếu.
 *
 * Bảo vệ bằng header `x-cron-secret`, đối chiếu biến môi trường CRON_SECRET.
 *
 * Đặt lịch mỗi ngày một lần (ví dụ 3 giờ sáng):
 *
 *    select cron.schedule(
 *      'cleanup-question-images',
 *      '0 3 * * *',
 *      $$
 *      select net.http_post(
 *        url := 'https://<địa-chỉ-ứng-dụng>/api/public/cron/don-anh',
 *        headers := '{"Content-Type":"application/json","x-cron-secret":"<GIÁ_TRỊ_CRON_SECRET>"}'::jsonb,
 *        body := '{}'::jsonb
 *      ) as request_id;
 *      $$
 *    );
 */
export const Route = createFileRoute("/api/public/cron/don-anh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cronAuth.server");
        if (!(await verifyCronRequest(request))) {
          return Response.json({ error: "Không có quyền." }, { status: 401 });
        }

        const { cleanupOrphanImages } = await import("@/lib/questionImages.server");
        const { formatBytes } = await import("@/lib/imageProcessing");
        const result = await cleanupOrphanImages();
        console.log(
          `[don-anh] Đã thu hồi ${result.deleted} tệp (${formatBytes(result.bytes)}) — ` +
            `${result.tmpCount} tệp tạm quá hạn, ${result.orphanCount} tệp mồ côi.`,
        );
        return Response.json({ ok: true, ...result, sizeLabel: formatBytes(result.bytes) });
      },
    },
  },
});
