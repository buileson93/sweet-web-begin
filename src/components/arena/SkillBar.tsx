import { SKILLS, skillCooldownLeft, type SkillId } from "@/lib/arena/skills";
import { cn } from "@/lib/utils";

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
    <div className="grid grid-cols-3 gap-2">
      {SKILLS.map((s) => {
        const rounds = uses.filter((u) => u.skill === s.id).map((u) => u.round);
        const cd = skillCooldownLeft(rounds, currentRound);
        const ready = cd === 0 && !disabled;
        const on = selected === s.id;
        return (
          <button
            key={s.id}
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
        );
      })}
    </div>
  );
}
