import { useEffect, useRef } from "react";

import { classById } from "@/lib/arena/classes";
import { SPRITE_FRAME, spriteClip, type SpriteAction } from "@/lib/arena/sprites";
import { cn } from "@/lib/utils";

/**
 * Nhân vật pixel-art chạy hoạt ảnh theo hành động (đứng thở / ra đòn / trúng đòn).
 * Hoạt ảnh chạy hoàn toàn bằng ref + background-position: không setState mỗi khung
 * nên không gây re-render 60fps (rất quan trọng khi mạng chậm / máy yếu).
 */
export function ClassSprite({
  classId,
  action = "idle",
  /** Lật ngang (dùng cho đấu thủ bên phải quay mặt sang trái). */
  flip = false,
  /** Chiều cao hiển thị (px). Sprite gốc 192px, nên scale bội số cho nét. */
  size = 144,
  className,
}: {
  classId?: string | null;
  action?: SpriteAction;
  flip?: boolean;
  size?: number;
  className?: string;
}) {
  const clip = spriteClip(classId, action);
  const idleClip = spriteClip(classId, "idle");
  const layerRef = useRef<HTMLDivElement | null>(null);
  const scale = size / SPRITE_FRAME;

  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    let raf = 0;
    let start = 0;
    let lastKey = "";
    let current = clip;

    const paint = (c: typeof clip, i: number) => {
      const key = `${c.url}#${i}`;
      if (key === lastKey) return;
      lastKey = key;
      el.style.backgroundImage = `url("${c.url}")`;
      el.style.backgroundSize = `${c.frames * SPRITE_FRAME * scale}px ${SPRITE_FRAME * scale}px`;
      el.style.backgroundPosition = `-${i * SPRITE_FRAME * scale}px 0px`;
    };

    paint(current, 0);

    const step = (t: number) => {
      if (!start) start = t;
      const per = current.durationMs / current.frames;
      const i = Math.floor((t - start) / per);
      if (!current.loop && i >= current.frames) {
        // Hết hoạt ảnh một lần (đánh / trúng đòn) thì quay lại tư thế đứng.
        current = idleClip;
        start = t;
        paint(current, 0);
      } else {
        paint(current, i % current.frames);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [clip, idleClip, scale]);

  const def = classById(classId);

  return (
    <div
      className={cn("relative select-none", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Nhân vật lớp ${def.name}`}
    >
      <div
        ref={layerRef}
        className="h-full w-full"
        style={{
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
          transform: flip ? "scaleX(-1)" : undefined,
        }}
      />
    </div>
  );
}

