import { Link } from "@tanstack/react-router";
import { ChevronRight, Sparkles } from "lucide-react";

import { AvatarBubble } from "@/components/player/AvatarBubble";
import { usePlayerIdentity } from "@/hooks/usePlayerIdentity";
import { cn } from "@/lib/utils";

/**
 * Thẻ nhân vật trên trang tổng quan: avatar 2D, cấp bậc và thanh kinh nghiệm.
 * Gọn trên mobile, không chiếm chỗ khi chưa tạo nhân vật.
 */
export function PlayerHeroCard({ className }: { className?: string }) {
  const { identity } = usePlayerIdentity();

  // Chưa có nhân vật: không hiển thị gì để tiết kiệm diện tích trang chủ.
  if (!identity) return null;



  return (
    <Link
      to="/nhan-vat"
      className={cn(
        "group flex items-center gap-3 rounded-2xl border border-border/70 bg-card/80 p-3 transition-all duration-200 hover:shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      <AvatarBubble
        name={identity.displayName}
        avatarUrl={identity.avatarUrl}
        avatarImage={identity.avatarImage}
        level={identity.level}
        size="sm"
        className="transition-transform duration-200 group-hover:scale-105"
      />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-extrabold">{identity.displayName}</span>
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-bold text-secondary-foreground">
            Cấp {identity.level}
          </span>
        </span>
        <span className="mt-1 block h-2 w-full overflow-hidden rounded-full bg-secondary">
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-700"
            style={{ width: `${identity.percent}%` }}
          />
        </span>
        <span className="mt-1 block truncate text-[0.7rem] text-muted-foreground">
          {identity.title} • {identity.into}/{identity.need} KN
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
