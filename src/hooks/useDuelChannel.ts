import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { arenaState } from "@/lib/arena.functions";
import type { DuelState } from "@/lib/arena/types";

export type DuelConnectionStatus = "live" | "syncing" | "retrying" | "offline";

type Options = { duelId: string; token: string; enabled?: boolean };

/**
 * Theo dõi diễn biến trận đấu.
 * Ưu tiên Realtime; nếu kênh chập chờn thì tự hạ xuống hỏi máy chủ định kỳ,
 * nên trận vẫn chạy đúng ngay cả khi mạng yếu.
 */
export function useDuelChannel({ duelId, token, enabled = true }: Options) {
  const [state, setState] = useState<DuelState | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<DuelConnectionStatus>("syncing");
  const versionRef = useRef(-1);
  const busyRef = useRef(false);

  const refresh = useCallback(
    async (force = false) => {
      if (!enabled || busyRef.current) return;
      busyRef.current = true;
      const started = performance.now();
      setConnectionStatus((current) => current === "live" ? "syncing" : current);
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
          setState(res.state);
        }
        setLatency(Math.round(performance.now() - started));
        setConnectionStatus(live ? "live" : "retrying");
        setError(null);
      } catch (e) {
        setConnectionStatus(navigator.onLine ? "retrying" : "offline");
        setError(e instanceof Error ? e.message : "Không lấy được diễn biến trận.");
      } finally {
        busyRef.current = false;
      }
    },
    [duelId, token, enabled, live],
  );

  useEffect(() => {
    if (!enabled) return;
    void refresh(true);

    const channel = supabase
      .channel(`duel:${duelId}`, { config: { broadcast: { self: true } } })
      .on("broadcast", { event: "*" }, () => void refresh())
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "duels", filter: `id=eq.${duelId}` },
        () => void refresh(),
      )
      .subscribe((status) => {
        const connected = status === "SUBSCRIBED";
        setLive(connected);
        setConnectionStatus(connected ? "live" : navigator.onLine ? "retrying" : "offline");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [duelId, enabled, refresh]);

  // Nhịp dự phòng: nhanh khi mất Realtime, chậm khi kênh còn sống,
  // và ngưng hẳn khi người dùng chuyển tab để không đốt tài nguyên máy chủ.
  useEffect(() => {
    if (!enabled) return;
    let id = 0;
    const start = () => {
      window.clearInterval(id);
      if (document.hidden) return;
      id = window.setInterval(() => void refresh(), live ? 4000 : 1200);
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
  }, [enabled, live, refresh]);

  useEffect(() => {
    const online = () => {
      setConnectionStatus("retrying");
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


  return { state, live, error, refresh, latency, connectionStatus };
}
