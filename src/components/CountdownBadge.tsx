import { useEffect, useState } from "react";
import { Hourglass } from "lucide-react";

import { countdownParts, msUntil } from "@/lib/countdown";
import { cn } from "@/lib/utils";

/** Đồng hồ đếm ngược tới giờ mở cuộc thi. */
export function CountdownBadge({
  target,
  className,
  size = "sm",
  label = "Đếm ngược tới giờ mở thi",
}: {
  target: string | null | undefined;
  className?: string;
  size?: "sm" | "lg";
  label?: string;
}) {
  const [left, setLeft] = useState(() => msUntil(target) ?? 0);


  useEffect(() => {
    setLeft(msUntil(target) ?? 0);
    const id = window.setInterval(() => setLeft(msUntil(target) ?? 0), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (msUntil(target) === null) return null;
  const p = countdownParts(left);
  if (p.done) return null;

  const cells: Array<[number, string]> = [
    [p.days, "ngày"],
    [p.hours, "giờ"],
    [p.minutes, "phút"],
    [p.seconds, "giây"],
  ];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-2xl bg-gold/20 px-2 py-1.5 text-gold-foreground",
        className,
      )}
      role="timer"
      aria-label={label}
    >
      <Hourglass className={cn("animate-pulse", size === "lg" ? "size-4" : "size-3.5")} strokeWidth={2.4} />
      <span className="flex items-center gap-1">
        {cells.map(([v, label], i) => (
          <span key={label} className="flex items-center gap-1">
            <span className="flex flex-col items-center leading-none">
              <span
                className={cn(
                  "font-heading font-extrabold tabular-nums",
                  size === "lg" ? "text-base" : "text-xs",
                )}
              >
                {String(v).padStart(2, "0")}
              </span>
              <span className="text-[0.55rem] font-semibold uppercase tracking-wide opacity-70">{label}</span>
            </span>
            {i < cells.length - 1 && <span className="text-xs font-bold opacity-40">:</span>}
          </span>
        ))}
      </span>
    </div>
  );
}
