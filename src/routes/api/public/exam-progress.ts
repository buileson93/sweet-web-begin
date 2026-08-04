import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Endpoint HTTP thuần cho autosave bằng navigator.sendBeacon khi tab bị ẩn / đóng.
 * Server function (RPC) không dùng được với sendBeacon nên phải có route riêng.
 *
 * QUAN TRỌNG: route này đi qua ĐÚNG các lớp kiểm tra như server function —
 * chuỗi băm, chữ ký khoá liveness, bằng chứng thao tác thật và trần tần suất —
 * để không trở thành cửa hậu cho script gửi trọn bộ đáp án.
 */
const answerSchema = z.union([
  z.number().int().min(0).max(50),
  z.array(z.number().int().min(0).max(50)).max(20),
  z.string().max(200),
  z.record(z.string(), z.number().int().min(0).max(50)),
]);

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  submitToken: z.string().uuid(),
  answers: z.record(z.string(), answerSchema),
  proofs: z
    .record(
      z.string(),
      z.object({
        trusted: z.boolean(),
        via: z.enum(["pointer", "key", "none"]).optional(),
        ageMs: z.number().optional(),
        at: z.number().optional(),
      }),
    )
    .optional(),
  clientSeq: z.number().int().min(0),
  chainPrev: z.string().length(64).optional(),
  chainHash: z.string().length(64).optional(),
  signature: z.string().min(16).max(500).optional(),
  at: z.number().int().positive().optional(),
  /** Chỉ chấp nhận gói thực sự phát sinh lúc tab bị ẩn. */
  reason: z.literal("beacon"),
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
          const { reason: _reason, ...payload } = parsed;
          const res = await saveExamProgress({ ...payload, source: "beacon" });
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
