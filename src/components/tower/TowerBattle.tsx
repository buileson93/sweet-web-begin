import { useEffect, useState } from "react";

import { ClassFx } from "@/components/arena/ClassFx";
import { ClassSprite } from "@/components/arena/ClassSprite";
import { MonsterSprite, type MonsterPose } from "@/components/tower/MonsterSprite";
import { classById } from "@/lib/arena/classes";
import { affinityOf, ELEMENTS, monsterById } from "@/lib/tower/monsters";
import type { TowerRun } from "@/lib/tower/engine";
import { cn } from "@/lib/utils";

export type BattleFx = {
  /** Ai vừa ra đòn. */
  side: "hero" | "foe";
  damage: number;
  note?: string;
  /** Tăng mỗi lần có đòn mới để chạy lại hoạt ảnh. */
  nonce: number;
};

/**
 * Sân đấu Leo Tháp: nhân vật của người chơi (kế thừa Đấu trường) đối đầu con quái
 * của phòng. Trả lời đúng thì nhân vật ra đòn, sai thì quái phản đòn.
 * Thuần trình bày — mọi con số vẫn do bộ máy engine quyết định.
 */
export function TowerBattle({
  run,
  foeHp,
  fx,
  className,
}: {
  run: TowerRun;
  /** Máu quái hiện thời (đã trừ phần đang xem trước). */
  foeHp: number;
  fx: BattleFx | null;
  className?: string;
}) {
  const foe = monsterById(run.monster?.id);
  const cls = classById(run.classId);
  const [heroPose, setHeroPose] = useState<"idle" | "attack" | "hurt">("idle");
  const [foePose, setFoePose] = useState<MonsterPose>("idle");
  const [pop, setPop] = useState<BattleFx | null>(null);

  useEffect(() => {
    if (!fx) return;
    setPop(fx);
    if (fx.side === "hero") {
      setHeroPose("attack");
      setFoePose(fx.note ? "stagger" : "hurt");
    } else {
      setHeroPose("hurt");
      setFoePose("attack");
    }
    const t1 = window.setTimeout(() => {
      setHeroPose("idle");
      setFoePose("idle");
    }, 900);
    const t2 = window.setTimeout(() => setPop(null), 1200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [fx?.nonce, fx]);

  // Quái sắp ra đòn khi người chơi đang bỏ trống câu — báo trước bằng tư thế nạp đòn.
  useEffect(() => {
    if (foeHp <= 0) setFoePose("defeat");
  }, [foeHp]);

  if (!foe || !run.monster) return null;
  const el = ELEMENTS[foe.element];
  const affinity = affinityOf(run.classId, foe.element);
  const pct = Math.max(0, Math.round((foeHp / run.monster.maxHp) * 100));

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-b from-muted/40 to-background p-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
          <span aria-hidden>{cls.icon}</span> {cls.name}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            affinity === "khac_che" && "bg-emerald-500/15 text-emerald-600",
            affinity === "bi_khac" && "bg-destructive/15 text-destructive",
            affinity === "can_bang" && "bg-muted text-muted-foreground",
          )}
        >
          {affinity === "khac_che"
            ? `Khắc hệ ${el.name} · +25% sát thương`
            : affinity === "bi_khac"
              ? `Bị hệ ${el.name} khắc · nhận +25% sát thương`
              : `Cân bằng với hệ ${el.name}`}
        </span>
        <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", el.tone)}>
          <span aria-hidden>{foe.icon}</span> {foe.name}
        </span>
      </div>

      <div className="relative mt-2 flex items-end justify-between gap-2">
        <div className="relative">
          <ClassSprite classId={run.classId} action={heroPose} size={104} />
          {heroPose !== "idle" && (
            <ClassFx classId={run.classId} pose={heroPose === "attack" ? "attack" : "hurt"} mine variant={run.floor} />
          )}
        </div>

        {pop && (
          <span
            aria-live="polite"
            className={cn(
              "pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 animate-damage-float text-sm font-black",
              pop.side === "hero" ? "text-emerald-500" : "text-destructive",
            )}
          >
            {pop.side === "hero" ? `-${pop.damage} sự cố` : `-${pop.damage} an toàn`}
          </span>
        )}

        <MonsterSprite monsterId={run.monster.id} pose={foePose} size={104} />
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{foe.taunt}</span>
          <span className="tabular-nums">
            {Math.max(0, foeHp)}/{run.monster.maxHp}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-destructive to-amber-500 transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {pop?.note && <p className="mt-1 text-[11px] font-medium text-muted-foreground">{pop.note}</p>}
    </div>
  );
}
