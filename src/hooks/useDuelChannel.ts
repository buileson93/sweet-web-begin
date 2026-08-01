import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { arenaState } from "@/lib/arena.functions";
import { classifyVersion, createClockSync } from "@/lib/arena/clock";
import { createDiagLog, type DiagEntry, type DiagKind } from "@/lib/arena/diagnostics";
import type { DuelState } from "@/lib/arena/types";

export type DuelConnectionStatus = "live" | "syncing" | "retrying" | "offline";

type Options = { duelId: string; token: string; enabled?: boolean };

/** Cửa sổ gom sự kiện: nhiều broadcast liên tiếp chỉ tạo MỘT lần đồng bộ. */
const BATCH_WINDOW_MS = 30;
/** Khoảng cách tối thiểu giữa hai lần hỏi máy chủ (trừ khi ép buộc). */
const MIN_GAP_MS = 120;
/** Ping vượt ngưỡng này thì ghi nhật ký "độ trễ cao". */
const SLOW_PING_MS = 900;


export type DuelNetStats = {
  /** Độ trễ vòng lặp gần nhất (ms). */
  ping: number | null;
  /** Ping trung bình trượt (ms). */
  avgPing: number | null;
  /** Số lần phải dựng lại kênh realtime. */
  reconnects: number;
  /** Khoảng cách từ lúc nhận broadcast tới lúc trạng thái được cập nhật (ms). */
  eventLag: number | null;
  /** Lệch đồng hồ client ↔ máy chủ (ms). */
  skew: number;
  /** Số gói bị bỏ vì trùng hoặc tới muộn. */
  dropped: number;
};

/**
 * Theo dõi diễn biến trận đấu.
 * - Hiệu chỉnh lệch đồng hồ để hai bên thấy xúc xắc/chốt lượt cùng một mốc thời gian.
 * - Gom (batch) sự kiện realtime và bỏ gói trùng/tới muộn để HP không nhảy sai.
 * - Tự kết nối lại theo bậc thang khi rớt mạng, khôi phục đúng lượt/HP hiện tại.
 * - Ghi nhật ký sự cố để người chơi gửi lại khi trạng thái bị lệch.
 */
export function useDuelChannel({ duelId, token, enabled = true }: Options) {
  const [state, setState] = useState<DuelState | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<DuelConnectionStatus>("syncing");
  const [attempt, setAttempt] = useState(0);
  const [stats, setStats] = useState<DuelNetStats>({
    ping: null,
    avgPing: null,
    reconnects: 0,
    eventLag: null,
    skew: 0,
    dropped: 0,
  });
  const [diag, setDiag] = useState<DiagEntry[]>([]);

  const versionRef = useRef(-1);
  const busyRef = useRef(false);
  const liveRef = useRef(false);
  const lastFetchRef = useRef(0);
  const batchTimer = useRef(0);
  const pendingForce = useRef(false);
  /** Số phiên bản mà bản dự đoán đang dựa vào; server vượt qua là hoà lại (reconcile). */
  const predictedOn = useRef<number | null>(null);
  /** Mốc nhận broadcast đầu tiên trong lô hiện tại — dùng để đo độ trễ sự kiện. */
  const eventAtRef = useRef<number | null>(null);
  const clock = useRef(createClockSync()).current;
  const diagLog = useRef(createDiagLog()).current;
  const avgPingRef = useRef<number | null>(null);
  const connectedOnceRef = useRef(false);

  const log = useCallback(
    (kind: DiagKind, message: string, detail?: Record<string, unknown>) => {
      diagLog.push(kind, message, detail);
      setDiag(diagLog.list());
    },
    [diagLog],
  );

  const refresh = useCallback(
    async (force = false) => {
      if (!enabled) return;
      if (busyRef.current) {
        pendingForce.current = pendingForce.current || force;
        return;
      }
      busyRef.current = true;
      const sentAt = Date.now();
      lastFetchRef.current = sentAt;
      setConnectionStatus((current) => (current === "live" ? "syncing" : current));
      try {
        const res = await arenaState({
          data: {
            token,
            duelId,
            sinceVersion: force || versionRef.current < 0 ? undefined : versionRef.current,
          },
        });
        const receivedAt = Date.now();
        const ping = receivedAt - sentAt;

        if (!res.unchanged) {
          const verdict = classifyVersion(versionRef.current, res.state.version);
          // Hiệu chỉnh đồng hồ theo mốc máy chủ (bù một nửa RTT).
          const skew = clock.push({
            sentAt,
            receivedAt,
            serverNow: Date.parse(res.state.serverNow),
          });
          if (verdict === "apply") {
            if (predictedOn.current !== null) {
              log("reconcile", "Máy chủ xác nhận, bỏ bản dự đoán tạm", {
                predictedOn: predictedOn.current,
                serverVersion: res.state.version,
              });
            }
            versionRef.current = res.state.version;
            predictedOn.current = null;
            setState(res.state);
          } else {
            // Gói trùng hoặc tới muộn: KHÔNG ghi đè, tránh HP/xúc xắc nhảy lùi.
            log(
              verdict === "duplicate" ? "duplicate" : "stale",
              verdict === "duplicate"
                ? "Bỏ qua gói trùng phiên bản"
                : "Bỏ qua gói tới muộn (phiên bản cũ)",
              { current: versionRef.current, incoming: res.state.version },
            );
            setStats((s) => ({ ...s, dropped: s.dropped + 1 }));
          }
          setStats((s) => ({ ...s, skew: Math.round(skew) }));
        }

        avgPingRef.current =
          avgPingRef.current === null ? ping : Math.round(avgPingRef.current * 0.7 + ping * 0.3);
        const eventAt = eventAtRef.current;
        eventAtRef.current = null;
        setLatency(ping);
        setStats((s) => ({
          ...s,
          ping,
          avgPing: avgPingRef.current,
          eventLag: eventAt === null ? s.eventLag : receivedAt - eventAt,
        }));
        if (ping >= SLOW_PING_MS) log("slow", `Độ trễ cao ${ping}ms`);
        setConnectionStatus(liveRef.current ? "live" : "retrying");
        setError(null);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Không lấy được diễn biến trận.";
        setConnectionStatus(navigator.onLine ? "retrying" : "offline");
        setError(message);
        log("error", message);
      } finally {
        busyRef.current = false;
        if (pendingForce.current) {
          pendingForce.current = false;
          void refresh(true);
        }
      }
    },
    [duelId, token, enabled, clock, log],
  );

  /** Gom nhiều sự kiện trong một cửa sổ ngắn rồi mới đồng bộ một lần. */
  const scheduleRefresh = useCallback(
    (force = false, fromEvent = false) => {
      pendingForce.current = pendingForce.current || force;
      if (fromEvent && eventAtRef.current === null) eventAtRef.current = Date.now();
      if (batchTimer.current) return;
      const since = Date.now() - lastFetchRef.current;
      const wait = Math.max(BATCH_WINDOW_MS, force ? 0 : MIN_GAP_MS - since);
      batchTimer.current = window.setTimeout(() => {
        batchTimer.current = 0;
        const f = pendingForce.current;
        pendingForce.current = false;
        void refresh(f);
      }, wait);
    },
    [refresh],
  );

  /**
   * Dự đoán phía client: áp ngay thay đổi lên giao diện trước khi máy chủ trả lời,
   * sau đó lần đồng bộ kế tiếp sẽ ghi đè bằng dữ liệu thật.
   */
  const predict = useCallback((patch: (prev: DuelState) => DuelState) => {
    setState((prev) => {
      if (!prev) return prev;
      predictedOn.current = prev.version;
      return patch(prev);
    });
  }, []);

  /**
   * Áp thẳng ảnh chụp trạng thái đi kèm broadcast — KHÔNG tốn thêm vòng HTTP.
   * Chỉ nhận khi phiên bản mới hơn; hụt phiên bản thì mới hỏi lại máy chủ.
   */
  const applySnapshot = useCallback(
    (incoming: DuelState) => {
      const verdict = classifyVersion(versionRef.current, incoming.version);
      if (verdict !== "apply") return true;
      versionRef.current = incoming.version;
      predictedOn.current = null;
      const at = eventAtRef.current;
      eventAtRef.current = null;
      setState((prev) => ({ ...incoming, you: prev?.you ?? incoming.you }));
      setConnectionStatus(liveRef.current ? "live" : "retrying");
      if (at !== null) setStats((s) => ({ ...s, eventLag: Date.now() - at }));
      return true;
    },
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    void refresh(true);

    let retryTimer = 0;
    const channel = supabase
      // `self: false`: người gửi không tự kích hoạt thêm một lần đồng bộ nữa.
      .channel(`duel:${duelId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "*" }, (msg) => {
        if (eventAtRef.current === null) eventAtRef.current = Date.now();
        const payload = (msg as { payload?: unknown }).payload;
        // Máy chủ gửi kèm nguyên trạng thái -> vẽ ngay, khỏi gọi lại máy chủ.
        if (
          (msg as { event?: string }).event === "state.sync" &&
          payload &&
          typeof payload === "object" &&
          typeof (payload as DuelState).version === "number"
        ) {
          applySnapshot(payload as DuelState);
          return;
        }
        scheduleRefresh(false, true);
      })
      .subscribe((status) => {

        const connected = status === "SUBSCRIBED";
        liveRef.current = connected;
        setLive(connected);
        if (connected) {
          setConnectionStatus("live");
          if (connectedOnceRef.current) {
            setStats((s) => ({ ...s, reconnects: s.reconnects + 1 }));
            log("reconnect", "Đã kết nối lại kênh realtime");
          } else {
            connectedOnceRef.current = true;
            log("connect", "Đã vào kênh realtime");
          }
          // Kết nối lại: kéo trạng thái đầy đủ để khôi phục đúng lượt và máu.
          void refresh(true);
          return;
        }
        setConnectionStatus(navigator.onLine ? "retrying" : "offline");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          log(status === "TIMED_OUT" ? "timeout" : "disconnect", `Kênh realtime: ${status}`);
          // Thử lại theo bậc thang 1s → 2s → 4s → tối đa 8s, không dồn dập.
          window.clearTimeout(retryTimer);
          retryTimer = window.setTimeout(
            () => setAttempt((n) => n + 1),
            Math.min(8000, 1000 * 2 ** Math.min(attempt, 3)),
          );
        }
      });

    return () => {
      window.clearTimeout(retryTimer);
      window.clearTimeout(batchTimer.current);
      batchTimer.current = 0;
      void supabase.removeChannel(channel);
    };
    // `attempt` tăng lên nghĩa là cần dựng lại kênh realtime.
  }, [duelId, enabled, refresh, scheduleRefresh, attempt, log]);

  // Nhịp dự phòng: nhanh khi mất Realtime, chậm khi kênh còn sống,
  // và ngưng hẳn khi người dùng chuyển tab để không đốt tài nguyên máy chủ.
  useEffect(() => {
    if (!enabled) return;
    let id = 0;
    const start = () => {
      window.clearInterval(id);
      if (document.hidden) return;
      id = window.setInterval(() => scheduleRefresh(), live ? 4000 : 1200);
    };
    const onVisible = () => {
      if (!document.hidden) void refresh(true);
      start();
    };
    start();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, live, refresh, scheduleRefresh]);

  useEffect(() => {
    const online = () => {
      setConnectionStatus("retrying");
      setAttempt((n) => n + 1);
      void refresh(true);
    };
    const offline = () => {
      setConnectionStatus("offline");
      log("disconnect", "Thiết bị mất mạng");
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [refresh, log]);

  /** Đổi mốc thời gian máy chủ (ISO) sang mốc đồng hồ của trình duyệt. */
  const toClientTime = useCallback(
    (serverIso: string | null | undefined, fallback = Date.now()) => {
      if (!serverIso) return fallback;
      const parsed = Date.parse(serverIso);
      return Number.isNaN(parsed) ? fallback : clock.toClient(parsed);
    },
    [clock],
  );

  const clockApi = useMemo(
    () => ({ toClientTime, skew: () => clock.skew(), serverNow: () => clock.serverNow() }),
    [toClientTime, clock],
  );

  return {
    state,
    live,
    error,
    refresh,
    latency,
    connectionStatus,
    predict,
    stats,
    diag,
    log,
    clock: clockApi,
  };
}
