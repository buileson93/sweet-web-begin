import { useEffect, useRef, useState } from "react";

import { ClassChip } from "@/components/arena/ClassPicker";
import { ClassSprite } from "@/components/arena/ClassSprite";
import { HpBar } from "@/components/arena/HpBar";
import { AvatarBubble } from "@/components/player/AvatarBubble";
import type { DuelPlayerView } from "@/lib/arena/types";
import { skillById } from "@/lib/arena/skills";
import { levelTitle } from "@/lib/xp";
import { cn } from "@/lib/utils";

type Fx = { id: number; text: string; tone: "hit" | "heal" | "skill" };

/** Khối thông tin một đấu thủ: avatar 2D, cấp bậc, máu, sát thương và hiệu ứng đánh nhau. */
export function DuelFighter({
  player,
  hpStart,
  mine,
  skill,
}: {
  player?: DuelPlayerView;
  hpStart: number;
  mine?: boolean;
  /** Kỹ năng vừa kích hoạt ở câu gần nhất (hiện hiệu ứng bay lên). */
  skill?: string | null;
}) {
  const hp = player?.hp ?? hpStart;
  const [fx, setFx] = useState<Fx[]>([]);
  const [shake, setShake] = useState(0);
  const [pose, setPose] = useState<"idle" | "attack" | "hurt">("idle");
  const prevHp = useRef(hp);
  const prevDealt = useRef(player?.damageDealt ?? 0);
  const seq = useRef(0);

  // Ra đòn: khi tổng sát thương gây ra tăng lên.
  const dealt = player?.damageDealt ?? 0;
  useEffect(() => {
    if (dealt <= prevDealt.current) {
      prevDealt.current = dealt;
      return;
    }
    prevDealt.current = dealt;
    setPose("attack");
    const t = window.setTimeout(() => setPose("idle"), 800);
    return () => window.clearTimeout(t);
  }, [dealt]);

  useEffect(() => {
    const diff = prevHp.current - hp;
    prevHp.current = hp;
    if (diff <= 0) return;
    seq.current += 1;
    const item: Fx = { id: seq.current, text: `-${diff}`, tone: "hit" };
    setFx((f) => [...f, item]);
    setShake(diff);
    setPose("hurt");
    const t1 = window.setTimeout(() => setFx((f) => f.filter((x) => x.id !== item.id)), 1100);
    const t2 = window.setTimeout(() => setShake(0), 600);
    const t3 = window.setTimeout(() => setPose("idle"), 800);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [hp]);

  const def = skillById(skill);
  useEffect(() => {
    if (!def) return;
    seq.current += 1;
    const item: Fx = { id: seq.current, text: `${def.icon} ${def.name}`, tone: "skill" };
    setFx((f) => [...f, item]);
    const t = window.setTimeout(() => setFx((f) => f.filter((x) => x.id !== item.id)), 1400);
    return () => window.clearTimeout(t);
  }, [def, player?.hp]);

  // Cường độ rung tăng dần theo mức sát thương phải nhận.
  const shakeClass =
    shake >= 16 ? "animate-hit-hard" : shake >= 8 ? "animate-hit-mid" : shake > 0 ? "animate-hit-soft" : "";

  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-1 flex-col gap-2 overflow-visible rounded-xl border bg-card p-3 transition",
        mine ? "border-primary/50" : "border-border",
        player?.left && "opacity-50",
        shakeClass,
      )}
    >
      {shake > 0 ? (
        <>
          <span className="pointer-events-none absolute inset-0 rounded-xl bg-destructive/25 animate-flash-hit" />
          <span className={cn("pointer-events-none absolute inset-y-4 z-20 w-20 animate-slash-hit", mine ? "-right-3" : "-left-3")} />
        </>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 -top-2 z-10 flex flex-col items-center">
        {fx.map((f) => (
          <span
            key={f.id}
            className={cn(
              "animate-float-up whitespace-nowrap text-lg font-black drop-shadow",
              f.tone === "hit" ? "text-rose-500" : "text-primary",
            )}
          >
            {f.text}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <AvatarBubble
          name={player?.displayName}
          avatarUrl={player?.avatarUrl}
          avatarImage={player?.avatarImage}
          level={player?.level}
          size="md"
          className={cn(shake > 0 && "animate-avatar-recoil")}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {player?.displayName ?? "Đang chờ đối thủ…"}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {player ? `${levelTitle(player.level)} · Elo ${player.elo}` : "—"}
          </p>
          {player ? <ClassChip classId={player.classId} className="mt-0.5" /> : null}
        </div>
        {player?.answered ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            đã chốt
          </span>
        ) : null}
      </div>
      <div className="relative flex h-24 items-end justify-center overflow-hidden rounded-lg bg-gradient-to-b from-primary/5 to-muted/40">
        <span className="pointer-events-none absolute bottom-2 h-3 w-16 rounded-[50%] bg-foreground/15 blur-[2px]" />
        <ClassSprite
          key={`${pose}-${dealt}-${hp}`}
          classId={player?.classId}
          action={pose}
          flip={!mine}
          size={128}
          className={cn(
            "-mb-1",
            pose === "attack" && (mine ? "animate-lunge-right" : "animate-lunge-left"),
            pose === "hurt" && (mine ? "animate-recoil-left" : "animate-recoil-right"),
          )}
        />
      </div>
      <HpBar hp={hp} hpStart={hpStart} mine={mine} />
      <p className="text-[11px] text-muted-foreground">
        ⚔️ {player?.damageDealt ?? 0} sát thương · ✅ {player?.correct ?? 0} câu đúng
      </p>
    </div>
  );
}
