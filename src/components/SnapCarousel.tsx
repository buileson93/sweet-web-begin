import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { recordCarouselEvent } from "@/lib/carouselAnalytics.functions";
import { detectDeviceType, getVisitorKey } from "@/lib/deviceInfo";
import { cn } from "@/lib/utils";

/**
 * Hybrid scroll: trang vẫn cuộn dọc tự do, còn dải thẻ này vuốt ngang và "hút" dứt khoát
 * vào từng thẻ. Trên máy tính (md trở lên) tự chuyển về lưới bình thường.
 *
 * Luôn chừa một phần thẻ kế tiếp lộ ra ở mép phải + chấm phân trang để người dùng
 * biết vẫn còn nội dung phía sau.
 *
 * Kèm đo lường: số thẻ đã đi qua, số lần vuốt, thời gian dừng và có bấm vào thẻ hay không.
 */
export function SnapCarousel({
  children,
  className,
  gridClassName = "md:grid-cols-2 2xl:grid-cols-3",
  itemWidth = "w-[86%]",
  label,
  track: trackAnalytics = true,
}: {
  children: ReactNode;
  className?: string;
  gridClassName?: string;
  itemWidth?: string;
  label?: string;
  /** Bật/tắt ghi nhận hành vi vuốt cho dải thẻ này. */
  track?: boolean;
}) {
  const items = Children.toArray(children);
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Số liệu đo lường tích luỹ trong suốt vòng đời dải thẻ
  const stats = useRef({
    startedAt: Date.now(),
    seen: new Set<number>([0]),
    maxIndex: 0,
    swipes: 0,
    clicked: false,
    clickedIndex: -1,
    sent: false,
  });

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
    setActive((prev) => {
      if (prev !== best) {
        stats.current.swipes += 1;
        stats.current.seen.add(best);
        stats.current.maxIndex = Math.max(stats.current.maxIndex, best);
      }
      return best;
    });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    syncActive();
    track.addEventListener("scroll", syncActive, { passive: true });
    return () => track.removeEventListener("scroll", syncActive);
  }, [syncActive, items.length]);

  // Gửi số liệu một lần khi người dùng rời dải thẻ / rời trang
  const total = items.length;
  useEffect(() => {
    if (!trackAnalytics || total === 0) return;
    const s = stats.current;

    const flush = () => {
      if (s.sent) return;
      const dwell = Date.now() - s.startedAt;
      // Bỏ qua lượt xem thoáng qua để tránh nhiễu số liệu
      if (dwell < 1500 && s.swipes === 0 && !s.clicked) return;
      s.sent = true;
      void recordCarouselEvent({
        data: {
          label: label ?? "carousel",
          path: window.location.pathname,
          total_cards: total,
          viewed_cards: s.seen.size,
          max_index: s.maxIndex,
          swipes: s.swipes,
          dwell_ms: dwell,
          clicked: s.clicked,
          clicked_index: s.clickedIndex,
          device_type: detectDeviceType(navigator.userAgent, window.innerWidth),
          visitor_key: getVisitorKey(),
        },
      }).catch(() => undefined);
    };

    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [label, total, trackAnalytics]);

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
          <div
            key={i}
            className={cn("snap-card min-w-0 shrink-0", itemWidth, "md:w-auto md:shrink")}
            onClickCapture={() => {
              stats.current.clicked = true;
              stats.current.clickedIndex = i;
            }}
          >
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
