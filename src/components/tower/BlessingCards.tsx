import { useEffect, useState } from "react";
import { AlertTriangle, Coins, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ELEMENT_LABEL, RARITY_LABEL, type Relic } from "@/lib/tower/relics";
import { cn } from "@/lib/utils";

const RARITY_TONE: Record<Relic["rarity"], string> = {
  thuong: "from-slate-500/25 to-slate-500/5 border-slate-400/50",
  hiem: "from-sky-500/30 to-sky-500/5 border-sky-400/60",
  suthi: "from-fuchsia-500/30 to-fuchsia-500/5 border-fuchsia-400/60",
  huyenthoai: "from-amber-400/35 to-amber-500/5 border-amber-300/70",
};

/** Cảnh báo đánh đổi: món nào có mặt trái thì nói thẳng để người chơi cân nhắc. */
function riskOf(relic: Relic): string | null {
  const e = relic.effect;
  if (e.revivePct) return "Chỉ cứu được một lần — thăng thiên cấp 10 vô hiệu hoá.";
  if (e.lowHpRagePct) return "Chỉ phát huy khi an toàn dưới 30% — lối chơi mạo hiểm.";
  if (e.reflectPct) return "Chỉ kích hoạt khi bạn trả lời sai, không giảm điểm xử lý.";
  if (e.heal) return "Hồi an toàn tức thời — vô dụng nếu đang mang yếu tố bất lợi Thiết bị trục trặc.";
  if (e.coinPct) return "Không tăng sức mạnh chiến đấu, chỉ có lợi khi còn ghé kho khí tài.";
  return null;
}

type Props = {
  offered: Relic[];
  picked: string | undefined;
  onPick: (id: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
};

/**
 * Hỗ trợ kíp trực — ba lá bài úp, lật lần lượt rồi mới chọn.
 * Mục tiêu: nhìn là hiểu món nào mạnh ở đâu và đánh đổi cái gì.
 */
export function BlessingCards({ offered, picked, onPick, onConfirm, onSkip }: Props) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    setRevealed(0);
    const timers = offered.map((_, i) => window.setTimeout(() => setRevealed((n) => Math.max(n, i + 1)), 220 * (i + 1)));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [offered]);

  if (!offered.length) return null;

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles className="size-4 animate-pulse text-amber-500" /> Hỗ trợ kíp trực — lật bài và chọn một trang bị
      </p>

      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Hỗ trợ kíp trực trang bị">
        {offered.map((relic, i) => {
          const open = revealed > i;
          const risk = riskOf(relic);
          const active = picked === relic.id;
          return (
            <button
              key={relic.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => (open ? onPick(relic.id) : setRevealed(i + 1))}
              className={cn("tower-card group relative h-44 w-full text-left", open && "is-open")}
            >
              <span className="tower-card__inner">
                {/* Mặt úp */}
                <span className="tower-card__face tower-card__back">
                  <span className="text-2xl">🎴</span>
                  <span className="type-meta mt-1">Chạm để lật</span>
                </span>
                {/* Mặt ngửa */}
                <span
                  className={cn(
                    "tower-card__face tower-card__front bg-gradient-to-b p-3",
                    RARITY_TONE[relic.rarity],
                    active && "ring-2 ring-primary",
                  )}
                >
                  <span className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wide opacity-70">
                    <span>{RARITY_LABEL[relic.rarity]}</span>
                    <span>{ELEMENT_LABEL[relic.element]}</span>
                  </span>
                  <span className="mt-1 text-2xl transition-transform duration-300 group-hover:scale-110">
                    {relic.icon}
                  </span>
                  <span className="mt-1 text-sm font-bold leading-tight">{relic.name}</span>
                  <span className="type-meta mt-1 leading-snug">{relic.desc}</span>
                  {risk ? (
                    <span className="mt-auto flex items-start gap-1 text-left text-[11px] leading-snug text-amber-600">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                      {risk}
                    </span>
                  ) : (
                    <span className="mt-auto text-[11px] text-emerald-600">Không có mặt trái.</span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!picked} onClick={onConfirm}>
          Nhận trang bị đã chọn
        </Button>
        <Button size="sm" variant="outline" onClick={onSkip}>
          <Coins className="mr-1.5 size-3.5" /> Bỏ qua, lấy 25 tín chỉ
        </Button>
      </div>
    </div>
  );
}
