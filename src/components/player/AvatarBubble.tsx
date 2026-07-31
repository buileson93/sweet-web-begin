import { lazy, Suspense, useState } from "react";
import { UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

const AvatarView3D = lazy(() => import("@/components/player/AvatarView3D"));

export type AvatarBubbleSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZES: Record<AvatarBubbleSize, string> = {
  xs: "size-8",
  sm: "size-11",
  md: "size-16",
  lg: "size-24",
  xl: "size-40",
};

const RING: Record<AvatarBubbleSize, string> = {
  xs: "ring-1",
  sm: "ring-2",
  md: "ring-2",
  lg: "ring-4",
  xl: "ring-4",
};

/**
 * Ảnh đại diện dạng vòng tròn với nhiều cỡ hiển thị.
 * Có mô hình 3D thì dựng 3D (khi bật `live`), nếu không thì dùng ảnh chân dung,
 * cuối cùng mới rơi về chữ cái đầu của họ tên.
 */
export function AvatarBubble({
  name,
  avatarUrl,
  avatarImage,
  size = "md",
  live = false,
  level,
  className,
}: {
  name?: string;
  avatarUrl?: string;
  avatarImage?: string;
  size?: AvatarBubbleSize;
  live?: boolean;
  level?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const initial = (name ?? "").trim().slice(0, 1).toUpperCase();
  const use3D = live && Boolean(avatarUrl);
  const useImage = !use3D && Boolean(avatarImage) && !broken;

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "grid place-items-center overflow-hidden rounded-full bg-secondary ring-primary/25",
          SIZES[size],
          RING[size],
        )}
      >
        {use3D ? (
          <Suspense fallback={<span className="size-full animate-pulse bg-secondary" />}>
            <AvatarView3D url={avatarUrl as string} className="size-full" />
          </Suspense>
        ) : useImage ? (
          <img
            src={avatarImage}
            alt={name ? `Ảnh đại diện của ${name}` : "Ảnh đại diện"}
            loading="lazy"
            onError={() => setBroken(true)}
            className="size-full object-cover"
          />
        ) : initial ? (
          <span className="font-heading font-extrabold text-muted-foreground">{initial}</span>
        ) : (
          <UserRound className="size-1/2 text-muted-foreground" />
        )}
      </span>
      {typeof level === "number" ? (
        <span className="absolute -bottom-1 -right-1 rounded-full bg-primary px-1.5 py-0.5 text-[0.625rem] font-extrabold leading-none text-primary-foreground shadow-[var(--shadow-lift)]">
          {level}
        </span>
      ) : null}
    </span>
  );
}
