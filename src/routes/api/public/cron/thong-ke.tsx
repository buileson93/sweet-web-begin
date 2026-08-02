import { createFileRoute } from "@tanstack/react-router";

/**
 * Làm mới bảng tổng hợp thống kê quản trị (chủ đề yếu toàn đơn vị).
 * Nên gọi mỗi 10–15 phút; bảo vệ bằng header `x-cron-secret`.
 *
 *   curl -X POST https://<địa-chỉ-ứng-dụng>/api/public/cron/thong-ke -H "x-cron-secret: $CRON_SECRET"
 */
export const Route = createFileRoute("/api/public/cron/thong-ke")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cronAuth.server");
        if (!(await verifyCronRequest(request))) {
          return Response.json({ error: "Không có quyền." }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.rpc("refresh_org_topic_stats");
        // Dọn dữ liệu đo lường cũ để không phình cơ sở dữ liệu (giữ 90 ngày).
        await supabaseAdmin.rpc("prune_carousel_events", { p_days: 90 } as never);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        return Response.json({ ok: true, refreshedAt: new Date().toISOString() });

      },
    },
  },
});
