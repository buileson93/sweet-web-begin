import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Endpoint HTTP thuần cho autosave bằng navigator.sendBeacon khi tab bị ẩn / đóng.
 * Server function (RPC) không dùng được với sendBeacon nên phải có route riêng.
 * "Xác thực" ở đây là cặp sessionId + submitToken (bí mật do máy chủ cấp khi mở phiên thi).
 */
const bodySchema = z.object({
  sessionId: z.string().uuid(),
  submitToken: z.string().uuid(),
  answers: z.record(
    z.string(),
    z.union([
      z.number().int().min(0).max(50),
      z.array(z.number().int().min(0).max(50)).max(20),
      z.string().max(200),
      z.record(z.string(), z.number().int().min(0).max(50)),
    ]),
  ),
  clientSeq: z.number().int().min(0),
});

export const Route = createFileRoute("/api/public/exam-progress")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return new Response(JSON.stringify({ error: "Dữ liệu không hợp lệ." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const { saveExamProgress } = await import("@/lib/exam.server");
          const res = await saveExamProgress(parsed);
          return Response.json(res);
        } catch (error) {
          return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Lỗi máy chủ." }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
