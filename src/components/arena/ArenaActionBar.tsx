import type { ReactNode } from "react";

/**
 * Thanh hành động cố định đáy màn hình cho Đấu trường.
 * Luôn nằm sát mép dưới trên mọi cỡ điện thoại (kể cả máy có thanh gạt nhà)
 * nhờ cộng thêm vùng an toàn `env(safe-area-inset-bottom)`.
 */
export function ArenaActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-[calc(0.75rem+env(safe-area-inset-left))] pb-[calc(0.625rem+env(safe-area-inset-bottom))] pr-[calc(0.75rem+env(safe-area-inset-right))] pt-2.5 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2">{children}</div>
    </div>
  );
}
