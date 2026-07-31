import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

type Options = {
  /** Bật/tắt kênh realtime */
  enabled?: boolean;
  /** Khoảng cách tối thiểu giữa 2 lần tải lại dữ liệu (ms) */
  throttleMs?: number;
  /** Chỉ theo dõi một cuộc thi cụ thể */
  quizId?: string | null;
  /** Query key cần làm mới */
  queryKey: unknown[];
};

/**
 * Theo dõi bảng kết quả theo thời gian thực.
 *
 * Để không làm quá tải quota: chỉ mở duy nhất một kênh, chỉ nghe sự kiện INSERT,
 * và gộp (throttle) các lần làm mới lại — nhiều bài nộp trong cùng một khoảng
 * thời gian chỉ tốn đúng một truy vấn. Kênh cũng tự ngắt khi tab bị ẩn.
 */
/**
 * Chu kỳ gộp mặc định. Cấu hình theo môi trường bằng biến VITE_REALTIME_THROTTLE_MS
 * (ví dụ 4000 khi ít người dùng, 20000 khi cần tiết kiệm quota máy chủ).
 */
export const DEFAULT_REALTIME_THROTTLE_MS = (() => {
  const raw = Number(import.meta.env.VITE_REALTIME_THROTTLE_MS);
  return Number.isFinite(raw) && raw >= 1000 ? raw : 8000;
})();

export function useRealtimeResults({
  enabled = true,
  throttleMs = DEFAULT_REALTIME_THROTTLE_MS,
  quizId,
  queryKey,
}: Options) {
  const qc = useQueryClient();
  const [live, setLive] = useState(false);
  const [pending, setPending] = useState(0);
  const lastRun = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(queryKey);
  keyRef.current = queryKey;

  useEffect(() => {
    if (!enabled) return;

    const refresh = () => {
      lastRun.current = Date.now();
      setPending(0);
      void qc.invalidateQueries({ queryKey: keyRef.current });
    };

    const schedule = () => {
      setPending((n) => n + 1);
      if (timer.current) return; // đã có lần làm mới đang chờ -> gộp lại
      const wait = Math.max(0, throttleMs - (Date.now() - lastRun.current));
      timer.current = setTimeout(() => {
        timer.current = null;
        if (document.visibilityState === "visible") refresh();
      }, wait);
    };

    const channel = supabase
      .channel(`results-live${quizId ? `-${quizId}` : ""}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "results",
          ...(quizId ? { filter: `quiz_id=eq.${quizId}` } : {}),
        },
        schedule,
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [enabled, qc, quizId, throttleMs]);

  return { live, pendingUpdates: pending };
}
