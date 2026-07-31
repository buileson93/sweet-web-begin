import { BookOpen, Compass, Cloud, Lightbulb, Plane, Radar, Sparkles, Star } from "lucide-react";

const ITEMS = [
  { Icon: Plane, className: "fx-drift-1 left-[4%] top-[18%] text-primary/25" },
  { Icon: Cloud, className: "fx-drift-2 right-[6%] top-[12%] text-accent/25" },
  { Icon: Star, className: "fx-drift-3 left-[12%] bottom-[22%] text-gold/40" },
  { Icon: Sparkles, className: "fx-drift-4 right-[10%] bottom-[28%] text-primary/25" },
  { Icon: Radar, className: "fx-drift-5 left-[46%] top-[6%] text-accent/20" },
  { Icon: BookOpen, className: "fx-drift-6 right-[22%] top-[46%] text-primary/20" },
  { Icon: Compass, className: "fx-drift-7 left-[22%] top-[52%] text-accent/20" },
  { Icon: Lightbulb, className: "fx-drift-8 right-[38%] bottom-[10%] text-gold/35" },
];

/** Lớp biểu tượng trang trí bay lơ lửng cho phòng thi thêm sinh động. */
export function AmbientFx() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden motion-reduce:hidden" aria-hidden>
      {ITEMS.map(({ Icon, className }, i) => (
        <Icon key={i} className={`absolute size-7 sm:size-9 ${className}`} strokeWidth={1.6} />
      ))}
    </div>
  );
}
