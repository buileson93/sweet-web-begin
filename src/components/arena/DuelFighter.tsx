import { HpBar } from "@/components/arena/HpBar";
import { AvatarBubble } from "@/components/player/AvatarBubble";
import type { DuelPlayerView } from "@/lib/arena/types";
import { levelTitle } from "@/lib/xp";
import { cn } from "@/lib/utils";

/** Khối thông tin một đấu thủ: avatar 2D, cấp bậc, máu và sát thương. */
export function DuelFighter({
  player,
  hpStart,
  mine,
  hitKey,
}: {
  player?: DuelPlayerView;
  hpStart: number;
  mine?: boolean;
  /** Đổi giá trị để kích hoạt hiệu ứng trúng đòn. */
  hitKey?: number;
}) {
  return (
    <div
      key={hitKey}
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border bg-card p-3 transition",
        mine ? "border-primary/50" : "border-border",
        player?.left && "opacity-50",
      )}
    >
      <div className="flex items-center gap-2">
        <AvatarBubble
          name={player?.displayName}
          avatarUrl={player?.avatarUrl}
          avatarImage={player?.avatarImage}
          level={player?.level}
          size="sm"
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
      <HpBar hp={player?.hp ?? hpStart} hpStart={hpStart} mine={mine} />
      <p className="text-[11px] text-muted-foreground">
        ⚔️ {player?.damageDealt ?? 0} sát thương · ✅ {player?.correct ?? 0} câu đúng
      </p>
    </div>
  );
}
