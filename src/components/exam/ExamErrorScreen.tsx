import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Màn hình dự phòng khi phòng thi gặp lỗi — luôn có lối thoát thay vì trắng màn hình. */
export function ExamErrorScreen({ error }: { error: unknown }) {
  const navigate = useNavigate();
  const message = error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.";
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background px-[calc(1rem+env(safe-area-inset-left))] py-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="card-elevated w-full max-w-md p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" />
        </span>
        <h1 className="type-h2 mt-4">Phòng thi gặp sự cố</h1>
        <p className="type-muted mt-2">
          Dữ liệu lượt thi không hợp lệ hoặc đã hết hạn. Bạn có thể bắt đầu lại một lượt thi mới.
        </p>
        <p className="type-meta mt-3 line-clamp-3 rounded-xl bg-secondary px-3 py-2 text-left">
          {message}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            className="rounded-full"
            onClick={() => {
              try {
                sessionStorage.clear();
              } catch {
                /* bỏ qua */
              }
              navigate({ to: "/" });
            }}
          >
            <RefreshCw className="size-4" /> Bắt đầu lượt thi mới
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => window.location.reload()}
          >
            Tải lại trang
          </Button>
        </div>
      </div>
    </div>
  );
}
