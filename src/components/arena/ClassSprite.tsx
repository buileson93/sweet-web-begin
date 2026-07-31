import { useEffect, useRef, useState } from "react";

import { classById } from "@/lib/arena/classes";
import { SPRITE_FRAME, spriteClip, type SpriteAction } from "@/lib/arena/sprites";
import { cn } from "@/lib/utils";

/**
 * Nhân vật pixel-art chạy hoạt ảnh theo hành động (đứng thở / ra đòn / trúng đòn).
 * Dùng requestAnimationFrame + background-position nên rất nhẹ, không tạo DOM thừa.
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
  const [frame, setFrame] = useState(0);
  const [done, setDone] = useState(false);
  const startRef = useRef(0);

  useEffect(() => {
    setFrame(0);
    setDone(false);
    startRef.current = 0;
    let raf = 0;
    const step = (t: number) => {
      if (!startRef.current) startRef.current = t;
      const elapsed = t - startRef.current;
      const per = clip.durationMs / clip.frames;
      const i = Math.floor(elapsed / per);
      if (!clip.loop && i >= clip.frames) {
        setFrame(clip.frames - 1);
        setDone(true);
        return;
      }
      setFrame(i % clip.frames);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [clip]);

  // Hết hoạt ảnh một lần (đánh / trúng đòn) thì quay lại tư thế đứng.
  const active = done && !clip.loop ? idleClip : clip;
  const shown = done && !clip.loop ? 0 : frame;
  const scale = size / SPRITE_FRAME;
  const def = classById(classId);

  return (
    <div
      className={cn("relative select-none", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Nhân vật lớp ${def.name}`}
    >
      <div
        className="h-full w-full"
        style={{
          backgroundImage: `url("${active.url}")`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${active.frames * SPRITE_FRAME * scale}px ${SPRITE_FRAME * scale}px`,
          backgroundPosition: `-${shown * SPRITE_FRAME * scale}px 0px`,
          imageRendering: "pixelated",
          transform: flip ? "scaleX(-1)" : undefined,
        }}
      />
    </div>
  );
}
