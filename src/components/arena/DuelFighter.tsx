import { useEffect, useRef, useState } from "react";

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
  const prevHp = useRef(hp);
  const seq = useRef(0);

  useEffect(() => {
    const diff = prevHp.current - hp;
    prevHp.current = hp;
    if (diff <= 0) return;
    seq.current += 1;
    const item: Fx = { id: seq.current, text: `-${diff}`, tone: "hit" };
    setFx((f) => [...f, item]);
    setShake(diff);
    const t1 = window.setTimeout(() => setFx((f) => f.filter((x) => x.id !== item.id)), 1100);
    const t2 = window.setTimeout(() => setShake(0), 600);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
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
        </div>
        {player?.answered ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            đã chốt
          </span>
        ) : null}
      </div>
      <HpBar hp={hp} hpStart={hpStart} mine={mine} />
      <p className="text-[11px] text-muted-foreground">
        ⚔️ {player?.damageDealt ?? 0} sát thương · ✅ {player?.correct ?? 0} câu đúng
      </p>
    </div>
  );
}
