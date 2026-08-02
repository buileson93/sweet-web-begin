import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Hybrid scroll: trang vẫn cuộn dọc tự do, còn dải thẻ này vuốt ngang và "hút" dứt khoát
 * vào từng thẻ. Trên máy tính (md trở lên) tự chuyển về lưới bình thường.
 *
 * Luôn chừa một phần thẻ kế tiếp lộ ra ở mép phải + chấm phân trang để người dùng
 * biết vẫn còn nội dung phía sau.
 */
export function SnapCarousel({
  children,
  className,
  gridClassName = "md:grid-cols-2 2xl:grid-cols-3",
  itemWidth = "w-[86%]",
  label,
}: {
  children: ReactNode;
  className?: string;
  gridClassName?: string;
  itemWidth?: string;
  label?: string;
}) {
  const items = Children.toArray(children);
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const syncActive = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    Array.from(track.children).forEach((child, i) => {
      const el = child as HTMLElement;
      const mid = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(mid - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setActive(best);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    syncActive();
    track.addEventListener("scroll", syncActive, { passive: true });
    return () => track.removeEventListener("scroll", syncActive);
  }, [syncActive, items.length]);

  function goTo(index: number) {
    const track = trackRef.current;
    const el = track?.children[index] as HTMLElement | undefined;
    if (!track || !el) return;
    track.scrollTo({ left: el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }

  return (
    <div className={className}>
      <div
        ref={trackRef}
        role="group"
        aria-label={label}
        className={cn(
          "snap-row -mx-4 flex gap-3 px-4 pb-1",
          "md:mx-0 md:grid md:gap-4 md:overflow-visible md:px-0 md:[scroll-snap-type:none]",
          gridClassName,
        )}
      >
        {items.map((child, i) => (
          <div key={i} className={cn("snap-card min-w-0 shrink-0", itemWidth, "md:w-auto md:shrink")}>
            {child}
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5 md:hidden">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Xem thẻ ${i + 1}`}
              aria-current={i === active}
              onClick={() => goTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === active ? "w-5 bg-primary" : "w-1.5 bg-border",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
