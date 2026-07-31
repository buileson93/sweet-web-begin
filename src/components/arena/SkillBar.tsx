import { SKILLS, skillCooldownLeft, type SkillId } from "@/lib/arena/skills";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Thanh chọn kỹ năng của ván so tài: bấm để nạp cho câu đang trả lời. */
export function SkillBar({
  uses,
  currentRound,
  selected,
  disabled,
  onSelect,
}: {
  uses: { skill: string; round: number }[];
  currentRound: number;
  selected: SkillId | null;
  disabled?: boolean;
  onSelect: (id: SkillId | null) => void;
}) {
  return (
    <TooltipProvider delayDuration={180}>
    <div className="grid grid-cols-3 gap-2">
      {SKILLS.map((s) => {
        const rounds = uses.filter((u) => u.skill === s.id).map((u) => u.round);
        const cd = skillCooldownLeft(rounds, currentRound);
        const ready = cd === 0 && !disabled;
        const on = selected === s.id;
        const range = s.id === "cong_pha" ? "+3–8 sát thương" : s.id === "chi_mang" ? "60% ×2, hụt +2" : "Chặn ngẫu nhiên 30–70%";
        return (
          <Tooltip key={s.id}>
          <TooltipTrigger asChild>
          <button
            type="button"
            disabled={!ready}
            title={`${s.name} — ${s.description}`}
            aria-pressed={on}
            onClick={() => onSelect(on ? null : s.id)}
            className={cn(
              "group relative overflow-hidden rounded-xl border px-2 py-2 text-center transition-all duration-200",
              ready ? "hover:-translate-y-0.5 hover:shadow-lg" : "opacity-50",
              on
                ? "border-primary bg-primary/15 shadow-[0_0_18px_-4px_hsl(var(--primary))]"
                : "border-border bg-card",
            )}
          >
            <span className={cn("block text-xl transition-transform", on && "animate-skill-pulse")}>
              {s.icon}
            </span>
            <span className="block truncate text-[11px] font-semibold">{s.name}</span>
            <span className="block text-[10px] text-muted-foreground">
              {cd > 0 ? `hồi ${cd} câu` : on ? "đã nạp" : "sẵn sàng"}
            </span>
          </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-64 space-y-1 bg-popover p-3 text-popover-foreground shadow-[var(--shadow-lift)]">
            <p className="font-bold">{s.icon} {s.name}</p>
            <p>{s.description}</p>
            <p className="font-mono text-[11px] text-primary">{range} · Hồi {5} lượt</p>
          </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
    </TooltipProvider>
  );
}
