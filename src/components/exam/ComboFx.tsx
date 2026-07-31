import { useEffect, useState } from "react";
import { Crown, Flame, Heart, Rocket, Sparkles, Star, Sun, Trophy, Zap } from "lucide-react";

import { comboTier, particleLayout, type ComboIcon, type ComboTier } from "@/lib/comboFx";
import { cn } from "@/lib/utils";

const ICONS: Record<ComboIcon, typeof Sparkles> = {
  sparkles: Sparkles,
  zap: Zap,
  flame: Flame,
  star: Star,
  rocket: Rocket,
  crown: Crown,
  trophy: Trophy,
  sun: Sun,
  heart: Heart,
};

export type ComboEvent = { id: number; combo: number };

/**
 * Hiệu ứng combo kiểu Audition: rung màn hình mạnh dần, chữ combo bung ra
 * kèm mưa biểu tượng. Mỗi cấp combo một kiểu hiệu ứng khác nhau.
 */
export function ComboFx({ event }: { event: ComboEvent | null }) {
  const [active, setActive] = useState<{ id: number; tier: ComboTier; combo: number } | null>(null);

  useEffect(() => {
    if (!event) return;
    const tier = comboTier(event.combo);
    if (!tier) return;

    setActive({ id: event.id, tier, combo: event.combo });

    const root = document.body;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      root.style.setProperty("--fx-amp", `${tier.amplitude}px`);
      root.classList.add("fx-shaking", tier.shake);
      navigator.vibrate?.(Array.from({ length: tier.level }, () => 18).flatMap((v) => [v, 40]));
    }

    const timer = window.setTimeout(() => {
      root.classList.remove("fx-shaking", tier.shake);
      setActive((cur) => (cur?.id === event.id ? null : cur));
    }, tier.duration);

    return () => {
      window.clearTimeout(timer);
      root.classList.remove("fx-shaking", tier.shake);
    };
  }, [event]);

  if (!active) return null;
  const { tier, combo } = active;
  const Icon = ICONS[tier.icon];

  return (
    <div
      key={active.id}
      className="pointer-events-none fixed inset-0 z-[70] grid place-items-center overflow-hidden"
      style={{ ["--fx-color" as string]: tier.color }}
      aria-hidden
    >
      <span className="fx-halo absolute size-40 rounded-full sm:size-56" />

      {particleLayout(tier).map((p, i) => (
        <span
          key={i}
          className="fx-particle absolute"
          style={{
            ["--fx-dx" as string]: `${p.dx}px`,
            ["--fx-dy" as string]: `${p.dy}px`,
            ["--fx-scale" as string]: String(p.scale),
            animationDelay: `${p.delay}ms`,
            animationDuration: `${tier.duration}ms`,
          }}
        >
          <Icon className="size-5 sm:size-6" style={{ color: tier.color }} strokeWidth={2.5} />
        </span>
      ))}

      <div className={cn("relative flex flex-col items-center gap-1", tier.burst)}>
        <span
          className="font-heading text-5xl font-black uppercase tracking-tighter drop-shadow-lg sm:text-7xl"
          style={{ color: tier.color, WebkitTextStroke: "1.5px oklch(1 0 0 / 0.75)" }}
        >
          x{combo}
        </span>
        <span
          className="font-heading rounded-full px-3 py-1 text-sm font-extrabold uppercase tracking-widest text-white shadow-lg sm:text-base"
          style={{ backgroundColor: tier.color }}
        >
          {tier.label}
        </span>
      </div>
    </div>
  );
}
