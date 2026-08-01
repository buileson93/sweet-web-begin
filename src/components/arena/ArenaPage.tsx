import type { ComponentType, ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";

/**
 * Khung trang dùng chung cho Đấu trường — lấy đúng nhịp lề, khoảng cách và cỡ
 * chữ của Trang chủ / Bảng xếp hạng để toàn hệ thống nhìn như một.
 */
export function ArenaPage({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <AppShell>
      <div className={cn("mx-auto w-full min-w-0 max-w-6xl space-y-5", className)}>{children}</div>
    </AppShell>
  );
}

/** Dải tiêu đề giống hệt Bảng xếp hạng: cùng bo góc, cùng lề, cùng thang chữ. */
export function ArenaHero({
  icon: Icon,
  title,
  description,
  decoration: Decoration,
  aside,
}: {
  icon: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  decoration?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  aside?: ReactNode;
}) {
  const Deco = Decoration ?? Icon;
  return (
    <div className="surface-hero animate-pop relative overflow-hidden rounded-2xl px-5 py-5 sm:px-7">
      <Deco aria-hidden className="animate-float absolute -right-4 -top-4 size-28 text-primary-foreground/10" />
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="surface-gold grid size-11 shrink-0 place-items-center rounded-xl shadow-[var(--shadow-gold)]">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="type-h2 text-primary-foreground">{title}</h1>
            {description ? (
              <p className="type-meta text-primary-foreground/75">{description}</p>
            ) : null}
          </div>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </div>
  );
}
