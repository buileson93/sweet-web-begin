import { classById } from "@/lib/arena/classes";
import { cn } from "@/lib/utils";

/**
 * Hiệu ứng ra đòn / đỡ đòn RIÊNG theo lớp chiến binh.
 *
 * - Kiếm sĩ : hai vệt chém chéo quét về phía đối thủ.
 * - Pháp sư : tụ phép ở tay rồi bắn quả cầu lửa (hoặc băng) bay ngang sân.
 * - Vệ binh : ra đòn là đập khiên tạo sóng xung kích; trúng đòn thì dựng khiên đỡ.
 *
 * Thuần trình bày: không giữ trạng thái, không tính toán trận đấu.
 */
export function ClassFx({
  classId,
  pose,
  mine,
  /** Đổi hệ phép của pháp sư theo lượt cho đỡ đơn điệu (lửa / băng). */
  variant = 0,
}: {
  classId?: string | null;
  pose: "attack" | "hurt";
  mine?: boolean;
  variant?: number;
}) {
  const def = classById(classId);
  const side = mine ? "right" : "left";

  if (pose === "attack") {
    if (def.id === "kiem_si")
      return (
        <>
          {[0, 1].map((i) => (
            <span
              key={i}
              aria-hidden
              className={cn(
                "pointer-events-none absolute z-20 h-1.5 w-28 rounded-full blur-[1.5px]",
                i === 0 ? "bottom-24" : "bottom-16",
                mine
                  ? "right-4 animate-slash-arc bg-gradient-to-r from-transparent via-sky-200 to-primary"
                  : "left-4 animate-slash-arc-flip bg-gradient-to-l from-transparent via-amber-100 to-rose-400",
                i === 1 && "[animation-delay:0.09s]",
              )}
            />
          ))}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute bottom-20 z-20 text-2xl animate-impact-spark",
              side === "right" ? "right-2" : "left-2",
            )}
          >
            ⚔️
          </span>
        </>
      );

    if (def.id === "phap_su") {
      const ice = variant % 2 === 1;
      return (
        <>
          {/* Tụ phép trước khi bắn. */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute bottom-20 z-20 size-10 rounded-full blur-[2px] animate-cast-charge",
              ice ? "bg-cyan-300/80" : "bg-orange-400/80",
              side === "right" ? "right-10" : "left-10",
            )}
          />
          {/* Quả cầu phép bay sang sân đối phương. */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute bottom-20 z-30 grid size-9 place-items-center rounded-full text-xl shadow-lg [animation-delay:0.16s]",
              ice
                ? "bg-cyan-200/90 shadow-cyan-400/60"
                : "bg-orange-300/90 shadow-orange-500/60",
              side === "right" ? "right-6 animate-orb-right" : "left-6 animate-orb-left",
            )}
          >
            {ice ? "❄️" : "🔥"}
          </span>
          {/* Đuôi phép kéo theo quả cầu. */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute bottom-[5.4rem] z-20 h-3 w-20 rounded-full blur-[3px] [animation-delay:0.16s]",
              ice ? "bg-cyan-300/60" : "bg-orange-400/60",
              side === "right" ? "right-4 animate-orb-right" : "left-4 animate-orb-left",
            )}
          />
        </>
      );
    }

    // Vệ binh: đập khiên, sóng xung kích lan ra.
    return (
      <>
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-16 z-30 text-3xl animate-shield-block",
            side === "right" ? "right-6" : "left-6",
          )}
        >
          🛡️
        </span>
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-16 z-20 size-16 rounded-full border-2 border-amber-400/70 animate-bash",
            side === "right" ? "right-4" : "left-4",
          )}
        />
      </>
    );
  }

  // ----- Trúng đòn -----
  if (def.id === "ve_binh")
    return (
      <>
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-16 z-30 text-4xl animate-shield-block drop-shadow",
            side === "right" ? "right-2" : "left-2",
          )}
        >
          🛡️
        </span>
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-14 z-20 size-20 rounded-full border-2 border-sky-300/70 bg-sky-300/10 animate-shield-wave",
            side === "right" ? "right-0" : "left-0",
          )}
        />
      </>
    );

  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute bottom-14 z-30 grid size-14 place-items-center text-3xl animate-impact-spark",
        side === "right" ? "right-16" : "left-16",
      )}
    >
      💥
    </span>
  );
}
