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
      <div
        className={cn(
          "relative flex h-44 items-end overflow-hidden rounded-lg bg-gradient-to-b from-primary/5 to-muted/40 sm:h-52",
          // Hai nhân vật đứng quay mặt vào nhau, dồn sát về phía sân giữa.
          mine ? "justify-end pr-0" : "justify-start pl-0",
        )}
      >
        {/* Hào quang thở liên tục quanh nhân vật + vòng năng lượng lan ra. */}
        <span
          className={cn(
            "pointer-events-none absolute bottom-3 h-20 w-20 rounded-full blur-xl animate-aura-pulse",
            mine ? "right-8 bg-primary/30" : "left-8 bg-rose-500/25",
          )}
        />
        <span
          className={cn(
            "pointer-events-none absolute bottom-4 h-16 w-16 rounded-full border animate-aura-ring",
            mine ? "right-10 border-primary/40" : "left-10 border-rose-500/40",
          )}
        />
        {/* Bụi nền bốc lên cho sân đấu có chiều sâu. */}
        <span
          className={cn(
            "pointer-events-none absolute bottom-3 h-2 w-2 rounded-full bg-foreground/20 blur-[1px] animate-ground-dust",
            mine ? "right-16" : "left-16",
          )}
        />
        <span
          className={cn(
            "pointer-events-none absolute bottom-3 h-1.5 w-1.5 rounded-full bg-foreground/15 blur-[1px] animate-ground-dust [animation-delay:1.1s]",
            mine ? "right-24" : "left-24",
          )}
        />
        <span
          className={cn(
            "pointer-events-none absolute bottom-2 h-3 w-24 rounded-[50%] bg-foreground/15 blur-[2px]",
            mine ? "right-10" : "left-10",
          )}
        />
        {/* Vệt chém bay về phía đối thủ khi ra đòn. */}
        {pose === "attack" ? (
          <span
            className={cn(
              "pointer-events-none absolute bottom-12 z-20 h-10 w-24 rounded-full blur-[3px]",
              mine
                ? "right-2 animate-trail-right bg-gradient-to-r from-transparent via-primary/70 to-transparent"
                : "left-2 animate-trail-left bg-gradient-to-l from-transparent via-rose-400/70 to-transparent",
            )}
          />
        ) : null}
        {/* Tia va chạm khi trúng đòn. */}
        {pose === "hurt" ? (
          <span
            className={cn(
              "pointer-events-none absolute bottom-14 z-30 grid size-14 place-items-center text-3xl animate-impact-spark",
              mine ? "right-16" : "left-16",
            )}
            aria-hidden
          >
            💥
          </span>
        ) : null}
        {/* Bọc ngoài để nháy trắng (filter) không đè hoạt ảnh lao/giật (transform). */}
        <div className={cn(pose === "hurt" && "animate-sprite-flash")}>
          <ClassSprite
            key={`${pose}-${dealt}-${hp}`}
            classId={player?.classId}
            action={pose}
            flip={!mine}
            size={196}
            className={cn(
              "-mb-3 drop-shadow-[0_8px_12px_rgba(0,0,0,0.35)]",
              pose === "idle" && "animate-idle-bob",
              pose === "attack" && (mine ? "animate-lunge-right" : "animate-lunge-left"),
              pose === "hurt" && (mine ? "animate-recoil-left" : "animate-recoil-right"),
            )}
          />
        </div>

      </div>


      <HpBar hp={hp} hpStart={hpStart} mine={mine} />
      <p className="text-[11px] text-muted-foreground">
        ⚔️ {player?.damageDealt ?? 0} sát thương · ✅ {player?.correct ?? 0} câu đúng
      </p>
    </div>
  );
}
