import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Home } from "lucide-react";

/**
 * Nút điều hướng nổi luôn hiển thị ở mọi trang (trừ trang chủ và màn hình đang thi):
 * "Quay lại" trang trước và "Trang chủ".
 */
export function BackNav() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const hidden = pathname === "/" || pathname.startsWith("/thi");
  if (hidden) return null;

  return (
    <div
      className="fixed left-[calc(0.75rem+env(safe-area-inset-left))] bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 flex max-w-[calc(100vw-1.5rem)] items-center gap-1 rounded-full border border-border/70 bg-card/80 p-1 opacity-70 shadow-[var(--shadow-lift)] backdrop-blur-md transition-opacity hover:opacity-100 focus-within:opacity-100 lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
      role="navigation"
      aria-label="Điều hướng nhanh"
    >
      <button
        type="button"
        onClick={() => router.history.back()}
        aria-label="Quay lại"
        title="Quay lại"
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
      >
        <ArrowLeft className="size-4" strokeWidth={2} />
        <span className="hidden sm:inline">Quay lại</span>
      </button>
      <Link
        to="/"
        aria-label="Về trang chủ"
        title="Về trang chủ"
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-transform hover:brightness-110 active:scale-95"
      >
        <Home className="size-4" strokeWidth={2} />
        <span className="hidden sm:inline">Trang chủ</span>
      </Link>
    </div>
  );
}
