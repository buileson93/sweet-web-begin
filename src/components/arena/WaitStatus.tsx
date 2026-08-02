import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import type { DuelConnectionStatus } from "@/components/arena/ConnectionBadge";
import type { DuelPlayerView, DuelState } from "@/lib/arena/types";
import { cn } from "@/lib/utils";

/** Thời gian công bố kết quả (ms) — khớp REVEAL_MS của máy chủ. */
const REVEAL_MS = 2_000;

type Reason = { tone: "info" | "warn" | "bad"; text: string; hint?: string };

/**
 * Bảng "vì sao đang chờ" — luôn nói rõ nguyên nhân độ trễ cho cả hai bên thấy,
 * thay vì để màn hình đứng im khiến người chơi tưởng lag.
 * Thuần trình bày: chỉ đọc trạng thái đã có, không gọi máy chủ.
 */
export function WaitStatus({
  state,
  me,
  foe,
  connectionStatus,
  latency,
  toClientTime,
}: {
  state: DuelState;
  me?: DuelPlayerView;
  foe?: DuelPlayerView;
  connectionStatus: DuelConnectionStatus;
  latency: number | null;
  toClientTime: (iso: string | null | undefined, fallback?: number) => number;
}) {
  // Nhịp 250ms chỉ để đếm giây trong bảng này — không kéo theo phần còn lại của trận.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  const reason = pickReason({ state, me, foe, connectionStatus, latency, toClientTime });
  if (!reason) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
        reason.tone === "bad"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : reason.tone === "warn"
            ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
            : "border-primary/30 bg-primary/5 text-primary",
      )}
    >
      <Loader2 className="size-3.5 shrink-0 animate-spin" />
      <div className="min-w-0">
        <p className="font-semibold">{reason.text}</p>
        {reason.hint ? <p className="text-[11px] opacity-80">{reason.hint}</p> : null}
      </div>
    </div>
  );
}

function secs(ms: number) {
  return Math.max(0, Math.ceil(ms / 1000));
}

/** Chọn nguyên nhân chờ đáng nói nhất tại thời điểm hiện tại. */
function pickReason({
  state,
  me,
  foe,
  connectionStatus,
  latency,
  toClientTime,
}: {
  state: DuelState;
  me?: DuelPlayerView;
  foe?: DuelPlayerView;
  connectionStatus: DuelConnectionStatus;
  latency: number | null;
  toClientTime: (iso: string | null | undefined, fallback?: number) => number;
}): Reason | null {
  const now = Date.now();

  if (connectionStatus === "offline")
    return {
      tone: "bad",
      text: "Mất kết nối tới máy chủ trận đấu",
      hint: "Đang tự kết nối lại — kết quả lượt vẫn do máy chủ giữ, bạn không bị xử thua.",
    };
  if (connectionStatus === "retrying")
    return {
      tone: "warn",
      text: "Mạng chập chờn — đang kết nối lại",
      hint: latency ? `Độ trễ hiện tại ${latency}ms.` : undefined,
    };

  if (foe?.left)
    return { tone: "warn", text: "Đối thủ đã rời phòng", hint: "Máy chủ đang chốt kết quả ván." };

  if (state.status === "waiting")
    return state.players.length < 2
      ? { tone: "info", text: "Đang chờ đối thủ vào phòng", hint: "Gửi liên kết mời để vào ngay." }
      : me?.ready
        ? { tone: "info", text: "Bạn đã sẵn sàng — chờ đối thủ bấm sẵn sàng" }
        : null;

  if (state.status !== "playing") return null;

  const r = state.lastResult;
  if (r && r.roundIndex === state.currentRound && r.resolvedAt) {
    const left = toClientTime(r.resolvedAt) + REVEAL_MS - now;
    return {
      tone: "info",
      text: `Đang công bố kết quả — câu tiếp theo sau ${secs(left)}s`,
    };
  }

  const endAt = state.roundServedAt
    ? toClientTime(state.roundServedAt) + state.secondsPerRound * 1000
    : 0;
  const left = endAt - now;

  if (endAt && left <= 0)
    return {
      tone: "warn",
      text: "Hết giờ — máy chủ đang chốt lượt",
      hint: latency && latency >= 600
        ? `Đường truyền đang chậm (${latency}ms), sẽ chốt trong giây lát.`
        : "Ai không trả lời kịp sẽ mất lượt tấn công.",
    };

  if (me?.answered && !foe?.answered && foe)
    return {
      tone: "info",
      text: `Bạn đã chốt — đang chờ ${foe.displayName ?? "đối thủ"} trả lời (còn ${secs(left)}s)`,
      hint: "Hết giờ là sang câu mới ngay, đối thủ mất lượt tấn công.",
    };

  return null;
}
