import { Link } from "@tanstack/react-router";
import { UserRoundPlus } from "lucide-react";

import { AvatarBubble, type AvatarBubbleSize } from "@/components/player/AvatarBubble";
import { usePlayerIdentity } from "@/hooks/usePlayerIdentity";
import { cn } from "@/lib/utils";

/**
 * Avatar 2D + thanh kinh nghiệm của người đang dùng máy, hiển thị đồng bộ ở header và trang chủ.
 * Chưa có nhận diện thì hiện lối tắt tạo nhân vật.
 */
export function PlayerChip({
  size = "sm",
  showBar = true,
  compact = false,
  className,
}: {
  size?: AvatarBubbleSize;
  showBar?: boolean;
  /** Chỉ hiện avatar (dùng cho header hẹp trên mobile). */
  compact?: boolean;
  className?: string;
}) {
  const { identity } = usePlayerIdentity();

  if (!identity) {
    return (
      <Link
        to="/nhan-vat"
        aria-label="Tạo nhân vật của bạn"
        title="Tạo nhân vật của bạn"
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border/70 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
          className,
        )}
      >
        <UserRoundPlus className="size-4" />
        {compact ? null : <span className="hidden sm:inline">Nhân vật</span>}
      </Link>
    );
  }

  return (
    <Link
      to="/nhan-vat"
      title={`${identity.displayName} — Cấp ${identity.level} ${identity.title}`}
      className={cn(
        "group inline-flex max-w-[13rem] items-center gap-2 rounded-full border border-border/70 bg-background/70 px-1.5 py-1 transition-all duration-200 hover:shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      <AvatarBubble
        name={identity.displayName}
        avatarUrl={identity.avatarUrl}
        avatarImage={identity.avatarImage}
        size={size}
        level={identity.level}
        className="transition-transform duration-200 group-hover:scale-105"
      />
      {compact ? null : (
        <span className="min-w-0 flex-1 pr-2">
          <span className="block truncate text-xs font-extrabold leading-tight">{identity.displayName}</span>
          {showBar ? (
            <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${identity.percent}%` }}
              />
            </span>
          ) : (
            <span className="block truncate text-[0.68rem] text-muted-foreground">Cấp {identity.level}</span>
          )}
        </span>
      )}
    </Link>
  );
}
