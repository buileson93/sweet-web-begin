import { memo, useEffect, useRef, useState } from "react";

import { ClassChip } from "@/components/arena/ClassPicker";
import { ClassFx, ClassGear } from "@/components/arena/ClassFx";
import { ClassSprite } from "@/components/arena/ClassSprite";
import { HpBar } from "@/components/arena/HpBar";
import { AvatarBubble } from "@/components/player/AvatarBubble";
import type { DuelPlayerView } from "@/lib/arena/types";
import { attackInfo } from "@/lib/arena/attacks";
import { sfxHit, sfxKo, sfxLowHp, sfxWounded } from "@/lib/arena/sfx";
import { skillById } from "@/lib/arena/skills";
import { levelTitle } from "@/lib/xp";
import { cn } from "@/lib/utils";

type Fx = { id: number; text: string; tone: "hit" | "heal" | "skill" };

/** Khối thông tin một đấu thủ: avatar 2D, cấp bậc, máu, sát thương và hiệu ứng đánh nhau. */
export const DuelFighter = memo(function DuelFighter({
  player,
  hpStart,
  mine,
  skill,
  roundKey,
  foeClassId,
}: {
  player?: DuelPlayerView;
  hpStart: number;
  mine?: boolean;
  /** Kỹ năng vừa kích hoạt ở câu gần nhất (hiện hiệu ứng bay lên). */
  skill?: string | null;
  /** Số hiệu lượt đấu — đổi lượt mới cho phép hiện lại hiệu ứng kỹ năng. */
  roundKey?: number;
  /** Lớp của đối thủ — để con số sát thương hiện đúng biểu tượng loại đòn. */
  foeClassId?: string | null;
}) {

  const hp = player?.hp ?? hpStart;
  const [fx, setFx] = useState<Fx[]>([]);
  const [shake, setShake] = useState(0);
  const [pose, setPose] = useState<"idle" | "attack" | "hurt">("idle");
  const prevHp = useRef(hp);
  const prevDealt = useRef(player?.damageDealt ?? 0);
  const seq = useRef(0);
  const timers = useRef<number[]>([]);

  // Dọn hẹn giờ MỘT LẦN khi rời màn hình. Không dọn giữa các đòn,
  // nếu không hiệu ứng cũ sẽ kẹt lại khi hai đòn nối nhau.
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    },
    [],
  );

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  // Ra đòn: khi tổng sát thương gây ra tăng lên.
  const dealt = player?.damageDealt ?? 0;
  useEffect(() => {
    if (dealt <= prevDealt.current) {
      prevDealt.current = dealt;
      return;
    }
    prevDealt.current = dealt;
    setPose("attack");
    later(() => setPose((p) => (p === "attack" ? "idle" : p)), 800);
  }, [dealt]);

  useEffect(() => {
    const diff = prevHp.current - hp;
    prevHp.current = hp;
    if (diff <= 0) return;
    seq.current += 1;
    // Con số sát thương kèm biểu tượng đúng loại đòn của đối thủ (chém/đâm/cầu lửa/…).
    const blow = attackInfo(foeClassId, roundKey ?? 0);
    const item: Fx = { id: seq.current, text: `${blow.icon} -${diff}`, tone: "hit" };
    setFx((f) => [...f, item]);
    setShake(diff);
    setPose("hurt");
    sfxHit(diff, !!mine);
    later(() => setFx((f) => f.filter((x) => x.id !== item.id)), 1100);
    later(() => setShake(0), 600);
    later(() => setPose((p) => (p === "hurt" ? "idle" : p)), 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hp]);

  const def = skillById(skill);
  useEffect(() => {
    if (!def) return;
    seq.current += 1;
    const item: Fx = { id: seq.current, text: `${def.icon} ${def.name}`, tone: "skill" };
    setFx((f) => [...f, item]);
    later(() => setFx((f) => f.filter((x) => x.id !== item.id)), 1400);
    // Chỉ phát lại khi sang lượt mới — không phát lại mỗi lần máu đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def?.id, roundKey]);

  // Tư thế theo thể trạng: còn nhiều máu đứng thẳng, yếu thì nghiêng người thở dốc,
  // nguy kịch thì quỳ gục xuống, hết máu thì đổ nghiêng.
  const ratio = hpStart > 0 ? hp / hpStart : 1;
  const stance = hp <= 0 ? "ko" : ratio <= 0.2 ? "critical" : ratio <= 0.4 ? "wounded" : "ok";
  const stanceClass =
    stance === "ko" ? "stance-ko" : stance === "critical" ? "stance-critical" : stance === "wounded" ? "stance-wounded" : "";

  // Âm thanh báo thể trạng — chỉ phát ĐÚNG lúc vừa vượt ngưỡng.
  const prevStance = useRef(stance);
  useEffect(() => {
    if (prevStance.current === stance) return;
    prevStance.current = stance;
    if (stance === "ko") sfxKo();
    else if (stance === "critical") sfxLowHp(!!mine);
    else if (stance === "wounded") sfxWounded(!!mine);
  }, [stance, mine]);

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
        {/* Vầng máu đỏ + giọt máu khi sắp gục. */}
        {stance === "critical" || stance === "ko" ? (
          <>
            <span
              className={cn(
                "pointer-events-none absolute bottom-6 h-24 w-24 rounded-full bg-rose-600/40 blur-2xl animate-low-hp",
                mine ? "right-8" : "left-8",
              )}
            />
            <span
              className={cn(
                "pointer-events-none absolute bottom-16 size-1.5 rounded-full bg-rose-500 animate-blood-drip",
                mine ? "right-16" : "left-16",
              )}
            />
          </>
        ) : null}

        {/* Trang bị riêng theo lớp: giáp kiếm sĩ, áo choàng + quyền trượng pháp sư, giáp nặng vệ binh. */}
        {player && stance !== "ko" ? <ClassGear classId={player.classId} mine={mine} /> : null}

        {/* Hiệu ứng riêng theo lớp: kiếm sĩ chém, pháp sư chưởng lửa/băng, vệ binh đỡ khiên. */}
        {pose !== "idle" ? (
          <ClassFx
            key={`${pose}-${roundKey ?? 0}`}
            classId={player?.classId}
            pose={pose}
            mine={mine}
            variant={roundKey ?? 0}
          />
        ) : null}

        {/* Bọc ngoài để nháy trắng (filter) không đè hoạt ảnh lao/giật (transform). */}
        <div className={cn(pose === "hurt" && "animate-sprite-flash")}>
          <ClassSprite
            classId={player?.classId}
            action={pose}
            flip={!mine}
            size={196}
            className={cn(
              "-mb-3 drop-shadow-[0_8px_12px_rgba(0,0,0,0.35)]",
              pose === "idle" && stance === "ok" && "animate-idle-bob",
              pose === "idle" && stanceClass,
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
})
