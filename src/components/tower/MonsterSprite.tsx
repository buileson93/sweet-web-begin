import { cn } from "@/lib/utils";
import { ELEMENTS, monsterById, type MonsterDef } from "@/lib/tower/monsters";

/** Sáu trạng thái hoạt ảnh của quái trong Leo Tháp. */
export type MonsterPose =
  /** 1. Lơ lửng thở đều — trạng thái chờ. */
  | "idle"
  /** 2. Nạp đòn: rung mạnh, quầng sáng dồn lại trước khi đánh. */
  | "charge"
  /** 3. Lao vào tấn công người chơi. */
  | "attack"
  /** 4. Trúng đòn: giật nảy và loé trắng. */
  | "hurt"
  /** 5. Choáng váng khi bị khắc hệ: quay lảo đảo, sao bay quanh đầu. */
  | "stagger"
  /** 6. Bị hạ: xẹp xuống rồi tan biến. */
  | "defeat";

/**
 * Hình tượng quái vật (sự cố) của Leo Tháp — thuần trình bày, không giữ trạng thái.
 * Mỗi hệ có nền quầng và hiệu ứng nền riêng, mỗi tư thế có hoạt ảnh riêng.
 */
export function MonsterSprite({
  monsterId,
  pose = "idle",
  size = 112,
  className,
}: {
  monsterId: string | null | undefined;
  pose?: MonsterPose;
  size?: number;
  className?: string;
}) {
  const def = monsterById(monsterId);
  if (!def) return null;
  const el = ELEMENTS[def.element];

  const poseClass: Record<MonsterPose, string> = {
    idle: "animate-foe-idle",
    charge: "animate-foe-charge",
    attack: "animate-foe-attack",
    hurt: "animate-foe-hurt",
    stagger: "animate-foe-stagger",
    defeat: "animate-foe-defeat",
  };

  return (
    <div
      className={cn("relative flex shrink-0 items-end justify-center", className)}
      style={{ width: size, height: size }}
      aria-label={`${def.name} — hệ ${el.name}`}
      role="img"
    >
      {/* Quầng hệ dưới chân quái */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-2 bottom-1 h-3 rounded-[50%] blur-[3px] opacity-70",
          def.element === "thoi_tiet" && "bg-sky-500/50",
          def.element === "ky_thuat" && "bg-violet-500/50",
          def.element === "con_nguoi" && "bg-amber-500/50",
        )}
      />
      <MotionAura def={def} pose={pose} />
      <span
        aria-hidden
        className={cn("select-none leading-none drop-shadow-lg", poseClass[pose])}
        style={{ fontSize: size * 0.62 }}
      >
        {def.icon}
      </span>
      {pose === "charge" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-destructive/60 animate-foe-telegraph"
        />
      )}
      {pose === "stagger" && (
        <span aria-hidden className="pointer-events-none absolute -top-1 left-1/2 animate-foe-stars text-lg">
          ✨💫✨
        </span>
      )}
      {pose === "hurt" && (
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl bg-background/70 animate-foe-flash" />
      )}
    </div>
  );
}

/** Hiệu ứng nền riêng theo kiểu vận động của quái. */
function MotionAura({ def, pose }: { def: MonsterDef; pose: MonsterPose }) {
  if (pose === "defeat") return null;
  if (def.motion === "storm")
    return (
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <span className="absolute left-1/3 top-0 h-full w-px bg-sky-300/60 animate-foe-rain" />
        <span className="absolute left-2/3 top-0 h-full w-px bg-sky-300/40 animate-foe-rain [animation-delay:.35s]" />
      </span>
    );
  if (def.motion === "pulse")
    return (
      <span
        aria-hidden
        className="pointer-events-none absolute inset-3 rounded-full border border-violet-400/50 animate-foe-pulse"
      />
    );
  if (def.motion === "swarm")
    return (
      <span aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute left-1 top-2 size-1.5 rounded-full bg-amber-400/70 animate-foe-orbit" />
        <span className="absolute right-1 top-4 size-1.5 rounded-full bg-amber-300/70 animate-foe-orbit [animation-delay:.6s]" />
      </span>
    );
  if (def.motion === "stomp")
    return (
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-4 bottom-0 h-1 rounded-full bg-destructive/50 animate-foe-shockwave"
      />
    );
  return null;
}
