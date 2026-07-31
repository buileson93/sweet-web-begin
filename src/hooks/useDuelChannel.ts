import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { arenaState } from "@/lib/arena.functions";
import type { DuelState } from "@/lib/arena/types";

export type DuelConnectionStatus = "live" | "syncing" | "retrying" | "offline";

type Options = { duelId: string; token: string; enabled?: boolean };

/** Cửa sổ gom sự kiện: nhiều broadcast liên tiếp chỉ tạo MỘT lần đồng bộ. */
const BATCH_WINDOW_MS = 70;
/** Khoảng cách tối thiểu giữa hai lần hỏi máy chủ (trừ khi ép buộc). */
const MIN_GAP_MS = 350;

/**
 * Theo dõi diễn biến trận đấu.
 * - Gom (batch) sự kiện realtime để giảm số lần cập nhật giao diện.
 * - Tự kết nối lại theo bậc thang khi rớt mạng, khôi phục đúng lượt/HP hiện tại.
 * - Cho phép dự đoán phía client và tự đối chiếu lại khi máy chủ xác nhận.
 */
export function useDuelChannel({ duelId, token, enabled = true }: Options) {
  const [state, setState] = useState<DuelState | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<DuelConnectionStatus>("syncing");
  const [attempt, setAttempt] = useState(0);
  const versionRef = useRef(-1);
  const busyRef = useRef(false);
  const liveRef = useRef(false);
  const lastFetchRef = useRef(0);
  const batchTimer = useRef(0);
  const pendingForce = useRef(false);
  /** Số phiên bản mà bản dự đoán đang dựa vào; server vượt qua là hoà lại (reconcile). */
  const predictedOn = useRef<number | null>(null);

  const refresh = useCallback(
    async (force = false) => {
      if (!enabled) return;
      if (busyRef.current) {
        pendingForce.current = pendingForce.current || force;
        return;
      }
      busyRef.current = true;
      const started = performance.now();
      lastFetchRef.current = Date.now();
      setConnectionStatus((current) => (current === "live" ? "syncing" : current));
      try {
        const res = await arenaState({
          data: {
            token,
            duelId,
            sinceVersion: force || versionRef.current < 0 ? undefined : versionRef.current,
          },
        });
        if (!res.unchanged) {
          versionRef.current = res.state.version;
          // Máy chủ đã xác nhận: bỏ bản dự đoán cũ, lấy sự thật từ máy chủ.
          predictedOn.current = null;
          setState(res.state);
        }
        setLatency(Math.round(performance.now() - started));
        setConnectionStatus(liveRef.current ? "live" : "retrying");
        setError(null);
      } catch (e) {
        setConnectionStatus(navigator.onLine ? "retrying" : "offline");
        setError(e instanceof Error ? e.message : "Không lấy được diễn biến trận.");
      } finally {
        busyRef.current = false;
        if (pendingForce.current) {
          pendingForce.current = false;
          void refresh(true);
        }
      }
    },
    [duelId, token, enabled],
  );

  /** Gom nhiều sự kiện trong một cửa sổ ngắn rồi mới đồng bộ một lần. */
  const scheduleRefresh = useCallback(
    (force = false) => {
      pendingForce.current = pendingForce.current || force;
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

  useEffect(() => {
    if (!enabled) return;
    void refresh(true);

    let retryTimer = 0;
    const channel = supabase
      .channel(`duel:${duelId}`, { config: { broadcast: { self: true } } })
      .on("broadcast", { event: "*" }, () => scheduleRefresh())
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "duels", filter: `id=eq.${duelId}` },
        () => scheduleRefresh(),
      )
      .subscribe((status) => {
        const connected = status === "SUBSCRIBED";
        liveRef.current = connected;
        setLive(connected);
        if (connected) {
          setConnectionStatus("live");
          // Kết nối lại: kéo trạng thái đầy đủ để khôi phục đúng lượt và máu.
          void refresh(true);
          return;
        }
        setConnectionStatus(navigator.onLine ? "retrying" : "offline");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
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
  }, [duelId, enabled, refresh, scheduleRefresh, attempt]);

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
    const offline = () => setConnectionStatus("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [refresh]);

  return { state, live, error, refresh, latency, connectionStatus, predict };
}
