import { classById } from "@/lib/arena/classes";
import { cn } from "@/lib/utils";

/**
 * Hiệu ứng chiến đấu RIÊNG theo lớp chiến binh, mỗi lớp có nhiều động tác luân phiên
 * theo lượt để trận đấu không đơn điệu.
 *
 * - Kiếm sĩ : chém chéo đôi → đâm xoáy → chém xoay 360; đỡ đòn là gạt kiếm loé giáp.
 * - Pháp sư : vòng rune + tụ phép rồi bắn cầu lửa / băng / sét bay ngang sân; đỡ là khiên phép rạn vỡ.
 * - Vệ binh : đập khiên tạo sóng xung kích → húc vai → giậm đất nứt sân; đỡ là dựng khiên nảy lửa.
 *
 * Thuần trình bày: không giữ trạng thái, không tính toán trận đấu.
 */
export function ClassFx({
  classId,
  pose,
  mine,
  /** Đổi động tác / hệ phép theo lượt cho đỡ đơn điệu. */
  variant = 0,
}: {
  classId?: string | null;
  pose: "attack" | "hurt";
  mine?: boolean;
  variant?: number;
}) {
  const def = classById(classId);
  const side = mine ? "right" : "left";
  const step = Math.abs(variant) % 3;

  if (pose === "attack") {
    if (def.id === "kiem_si") return <SwordAttack mine={mine} side={side} step={step} />;
    if (def.id === "phap_su") return <MageAttack mine={mine} side={side} step={step} />;
    return <GuardAttack mine={mine} side={side} step={step} />;
  }

  if (def.id === "kiem_si") return <SwordHurt side={side} />;
  if (def.id === "phap_su") return <MageHurt side={side} step={step} />;
  return <GuardHurt side={side} />;
}

type Side = "right" | "left";
const at = (side: Side, right: string, left: string) => (side === "right" ? right : left);

/* ------------------------- Kiếm sĩ ------------------------- */

function SwordAttack({ mine, side, step }: { mine?: boolean; side: Side; step: number }) {
  // 0: chém chéo đôi · 1: đâm xoáy · 2: chém xoay 360
  if (step === 1)
    return (
      <>
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-20 z-20 h-1 w-36 rounded-full bg-gradient-to-r from-transparent via-sky-100 to-primary blur-[1px]",
            mine ? "right-4 animate-thrust-right" : "left-4 animate-thrust-left",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-[4.6rem] z-20 size-8 rounded-full border-2 border-primary/70 animate-bash",
            at(side, "right-8", "left-8"),
          )}
        />
        <span
          aria-hidden
          className={cn("pointer-events-none absolute bottom-24 z-20 text-xl animate-impact-spark", at(side, "right-2", "left-2"))}
        >
          ✨
        </span>
      </>
    );

  if (step === 2)
    return (
      <>
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-14 z-20 size-28 rounded-full border-[3px] border-transparent border-t-sky-200 border-r-primary animate-spin-slash",
            at(side, "right-2", "left-2"),
          )}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-16 z-20 size-20 rounded-full border-2 border-transparent border-b-primary/70 animate-spin-slash [animation-delay:0.1s]",
            at(side, "right-6", "left-6"),
          )}
        />
        <span
          aria-hidden
          className={cn("pointer-events-none absolute bottom-20 z-20 text-2xl animate-impact-spark", at(side, "right-4", "left-4"))}
        >
          🌀
        </span>
      </>
    );

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
        className={cn("pointer-events-none absolute bottom-20 z-20 text-2xl animate-impact-spark", at(side, "right-2", "left-2"))}
      >
        ⚔️
      </span>
    </>
  );
}

function SwordHurt({ side }: { side: Side }) {
  return (
    <>
      <span
        aria-hidden
        className={cn("pointer-events-none absolute bottom-20 z-30 text-3xl animate-parry-glint", at(side, "right-6", "left-6"))}
      >
        🗡️
      </span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          style={{ ["--sx" as string]: `${(i - 1) * 18}px` }}
          className={cn(
            "pointer-events-none absolute bottom-20 z-20 size-1.5 rounded-full bg-amber-300 animate-guard-spark",
            at(side, "right-10", "left-10"),
          )}
        />
      ))}
    </>
  );
}

/* ------------------------- Pháp sư ------------------------- */

const ELEMENTS = [
  { icon: "🔥", orb: "bg-orange-300/90 shadow-orange-500/60", glow: "bg-orange-400/80", tail: "bg-orange-400/60", rune: "border-orange-400/70" },
  { icon: "❄️", orb: "bg-cyan-200/90 shadow-cyan-400/60", glow: "bg-cyan-300/80", tail: "bg-cyan-300/60", rune: "border-cyan-300/70" },
  { icon: "⚡", orb: "bg-violet-300/90 shadow-violet-500/60", glow: "bg-violet-400/80", tail: "bg-violet-400/60", rune: "border-violet-400/70" },
];

function MageAttack({ mine, side, step }: { mine?: boolean; side: Side; step: number }) {
  const el = ELEMENTS[step];
  const orbAnim = mine ? "animate-orb-right" : "animate-orb-left";
  return (
    <>
      {/* Vòng rune quay dưới chân khi niệm chú. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-3 z-10 size-24 rounded-full border-2 border-dashed animate-rune-spin",
          el.rune,
          at(side, "right-6", "left-6"),
        )}
      />
      {/* Tụ phép ở đầu quyền trượng. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-24 z-20 size-10 rounded-full blur-[2px] animate-cast-charge",
          el.glow,
          at(side, "right-10", "left-10"),
        )}
      />
      {/* Quả cầu phép bay sang sân đối phương. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-20 z-30 grid size-9 place-items-center rounded-full text-xl shadow-lg [animation-delay:0.16s]",
          el.orb,
          at(side, "right-6", "left-6"),
          orbAnim,
        )}
      >
        {el.icon}
      </span>
      {/* Đuôi phép kéo theo quả cầu. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-[5.4rem] z-20 h-3 w-20 rounded-full blur-[3px] [animation-delay:0.16s]",
          el.tail,
          at(side, "right-4", "left-4"),
          orbAnim,
        )}
      />
      {/* Hệ sét thì thêm tia chớp loé giữa sân. */}
      {step === 2 ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 bottom-6 z-20 h-28 bg-gradient-to-t from-transparent via-violet-200/70 to-transparent animate-bolt"
        />
      ) : null}
    </>
  );
}

function MageHurt({ side, step }: { side: Side; step: number }) {
  const el = ELEMENTS[step];
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-14 z-30 size-24 rounded-[28%] border-2 bg-white/10 animate-barrier-crack",
          el.rune,
          at(side, "right-2", "left-2"),
        )}
      />
      <span
        aria-hidden
        className={cn("pointer-events-none absolute bottom-24 z-30 text-2xl animate-impact-spark", at(side, "right-10", "left-10"))}
      >
        🔮
      </span>
    </>
  );
}

/* ------------------------- Vệ binh ------------------------- */

function GuardAttack({ mine, side, step }: { mine?: boolean; side: Side; step: number }) {
  // 0: đập khiên · 1: húc vai · 2: giậm đất
  if (step === 1)
    return (
      <>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              "pointer-events-none absolute z-20 h-1 w-24 rounded-full bg-foreground/25 blur-[1px]",
              i === 0 ? "bottom-24" : i === 1 ? "bottom-20" : "bottom-16",
              mine ? "right-10 animate-charge-dust-right" : "left-10 animate-charge-dust-left",
              i === 1 && "[animation-delay:0.06s]",
              i === 2 && "[animation-delay:0.12s]",
            )}
          />
        ))}
        <span
          aria-hidden
          className={cn("pointer-events-none absolute bottom-20 z-30 text-3xl animate-shield-block", at(side, "right-4", "left-4"))}
        >
          🛡️
        </span>
      </>
    );

  if (step === 2)
    return (
      <>
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-3 z-20 h-1.5 w-36 rounded-full bg-amber-500/70 blur-[1px] animate-stomp-crack",
            at(side, "right-2", "left-2"),
          )}
        />
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              "pointer-events-none absolute bottom-4 z-20 size-2 rounded-sm bg-foreground/40 animate-rock-up",
              at(side, `right-${8 + i * 6}`, `left-${8 + i * 6}`),
              i === 1 && "[animation-delay:0.08s]",
              i === 2 && "[animation-delay:0.16s]",
              i === 3 && "[animation-delay:0.24s]",
            )}
          />
        ))}
        <span
          aria-hidden
          className={cn("pointer-events-none absolute bottom-8 z-20 size-20 rounded-full border-2 border-amber-400/70 animate-bash", at(side, "right-6", "left-6"))}
        />
      </>
    );

  return (
    <>
      <span
        aria-hidden
        className={cn("pointer-events-none absolute bottom-16 z-30 text-3xl animate-shield-block", at(side, "right-6", "left-6"))}
      >
        🛡️
      </span>
      <span
        aria-hidden
        className={cn("pointer-events-none absolute bottom-16 z-20 size-16 rounded-full border-2 border-amber-400/70 animate-bash", at(side, "right-4", "left-4"))}
      />
    </>
  );
}

function GuardHurt({ side }: { side: Side }) {
  return (
    <>
      <span
        aria-hidden
        className={cn("pointer-events-none absolute bottom-16 z-30 text-4xl animate-shield-block drop-shadow", at(side, "right-2", "left-2"))}
      >
        🛡️
      </span>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-14 z-20 size-20 rounded-full border-2 border-sky-300/70 bg-sky-300/10 animate-shield-wave",
          at(side, "right-0", "left-0"),
        )}
      />
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          aria-hidden
          style={{ ["--sx" as string]: `${(i - 1.5) * 16}px` }}
          className={cn(
            "pointer-events-none absolute bottom-20 z-30 size-1.5 rounded-full bg-amber-300 animate-guard-spark",
            at(side, "right-8", "left-8"),
            i === 1 && "[animation-delay:0.06s]",
            i === 2 && "[animation-delay:0.12s]",
            i === 3 && "[animation-delay:0.18s]",
          )}
        />
      ))}
    </>
  );
}

/**
 * Lớp trang bị vẽ đè lên sprite để mỗi lớp nhìn ra chất riêng:
 * kiếm sĩ có giáp loé sáng, pháp sư khoác áo choàng + quyền trượng chéo, vệ binh giáp nặng.
 */
export function ClassGear({ classId, mine }: { classId?: string | null; mine?: boolean }) {
  const def = classById(classId);
  const side: Side = mine ? "right" : "left";

  if (def.id === "phap_su")
    return (
      <>
        {/* Áo choàng bay nhẹ sau lưng. */}
        <span
          aria-hidden
          className={cn(
            "gear-cape pointer-events-none absolute bottom-6 z-10 h-24 w-14 rounded-b-[60%] bg-gradient-to-b from-indigo-500/60 to-indigo-900/30 blur-[0.5px]",
            at(side, "right-24", "left-24"),
          )}
        />
        {/* Quyền trượng cầm chéo. */}
        <span
          aria-hidden
          className={cn("gear-staff pointer-events-none absolute bottom-8 z-30", at(side, "right-6", "left-6"))}
        >
          <span className="block h-24 w-1.5 rounded-full bg-gradient-to-b from-amber-700 to-amber-900" />
          <span className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_14px_4px_rgba(103,232,249,0.6)]" />
        </span>
      </>
    );

  if (def.id === "ve_binh")
    return (
      <>
        {/* Giáp nặng: bờ vai dày và vành khiên. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-[5.5rem] z-30 h-6 w-12 rounded-t-full bg-gradient-to-b from-slate-300/80 to-slate-600/70 shadow-inner",
            at(side, "right-16", "left-16"),
          )}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-14 z-30 h-14 w-9 rounded-[45%] border-2 border-slate-200/70 bg-gradient-to-b from-slate-400/60 to-slate-700/60",
            at(side, "right-6", "left-6"),
          )}
        />
        <span
          aria-hidden
          className={cn("gear-glint pointer-events-none absolute bottom-14 z-30 h-14 w-3 bg-white/70 blur-[2px]", at(side, "right-8", "left-8"))}
        />
      </>
    );

  // Kiếm sĩ: giáp sáng bóng, thỉnh thoảng loé.
  return (
    <span
      aria-hidden
      className={cn("gear-glint pointer-events-none absolute bottom-16 z-30 h-16 w-4 bg-white/70 blur-[2px]", at(side, "right-14", "left-14"))}
    />
  );
}
