import { createFileRoute } from "@tanstack/react-router";

/**
 * Watchdog Đấu trường — nên gọi mỗi 5 giây.
 * Bảo vệ bằng header `x-cron-secret` đối chiếu biến môi trường CRON_SECRET.
 *
 *   curl -X POST https://<địa-chỉ-ứng-dụng>/api/public/cron/dau-truong -H "x-cron-secret: $CRON_SECRET"
 */
export const Route = createFileRoute("/api/public/cron/dau-truong")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cronAuth.server");
        if (!(await verifyCronRequest(request))) {
          return Response.json({ error: "Không có quyền." }, { status: 401 });
        }

        const { tickDuels, closeFinishedSeasons } = await import("@/lib/arena/tick.server");
        const tick = await tickDuels();
        const season = await closeFinishedSeasons();
        return Response.json({ ok: true, ...tick, ...season });
      },
    },
  },
});
