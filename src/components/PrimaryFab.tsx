import { Link, useRouterState } from "@tanstack/react-router";
import { PlayCircle } from "lucide-react";

/**
 * Nút hành động chính (FAB) đặt trong vùng ngón cái, góc dưới bên phải.
 * Mỗi màn hình chỉ có một tác vụ chính: bắt đầu làm bài thi.
 * Ẩn khi đang thi, đang ở đấu trường hoặc trong khu quản trị.
 */
export function PrimaryFab() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const hidden =
    pathname.startsWith("/thi") ||
    pathname.startsWith("/dau-truong") ||
    pathname.startsWith("/quan-tri") ||
    pathname.startsWith("/nhap-du-lieu") ||
    pathname.startsWith("/auth");

  if (hidden) return null;

  return (
    <Link
      to="/"
      hash="cuoc-thi"
      aria-label="Vào thi ngay"
      title="Vào thi ngay"
      className="fixed right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 inline-flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-lift)] transition-transform hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95 lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
    >
      <PlayCircle className="size-5 shrink-0" strokeWidth={2.25} />
      Vào thi
    </Link>
  );
}
