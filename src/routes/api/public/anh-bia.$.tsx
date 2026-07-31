import { createFileRoute } from "@tanstack/react-router";

/**
 * Đọc hộ ảnh chìm (ảnh bìa) của cuộc thi từ kho lưu trữ nội bộ.
 * Kho không mở công khai; chỉ ảnh bìa được phục vụ qua đường dẫn này.
 */
export const Route = createFileRoute("/api/public/anh-bia/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = decodeURIComponent((params as { _splat?: string })._splat ?? "");
        if (!path || path.includes("..")) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("quiz-covers").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });

        return new Response(await data.arrayBuffer(), {
          headers: {
            "Content-Type": data.type || "image/webp",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
