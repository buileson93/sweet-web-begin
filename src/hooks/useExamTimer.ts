import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getServerTime } from "@/lib/exam.functions";

/** Nguồn phát số giây còn lại cho component đồng hồ (useSyncExternalStore). */
export type ExamClockStore = {
  get: () => number;
  subscribe: (fn: () => void) => () => void;
};

/** Chu kỳ đồng bộ lại giờ máy chủ (chống trôi khi máy sleep hoặc đổi giờ hệ thống). */
const RESYNC_MS = 60_000;

/**
 * Đồng hồ đếm ngược theo thời gian máy chủ (bù chênh lệch giờ máy người dùng).
 * Offset được tính lại định kỳ 60 giây và mỗi khi tab hiển thị trở lại.
 * Khi về 0 sẽ gọi onTimeUp đúng MỘT lần cho mỗi phiên thi.
 */
export function useExamTimer(opts: {
  expiresAt: string | null | undefined;
  serverNow: string | null | undefined;
  /** Chỉ chạy khi đang làm bài (có phiên và chưa có kết quả). */
  active: boolean;
  /** Chặn tự nộp khi người thi vừa bấm nộp thủ công. */
  canAutoSubmit: () => boolean;
  onTimeUp: () => void;
}) {
  const [timeUp, setTimeUp] = useState(false);
  /**
   * Số giây còn lại nằm ở store ngoài (không phải state) để mỗi nhịp 1 giây
   * chỉ render lại đúng component đồng hồ, không render lại cả cây phòng thi.
   */
  const remainingRef = useRef(0);
  const listenersRef = useRef(new Set<() => void>());
  const setRemaining = useCallback((value: number) => {
    if (remainingRef.current === value) return;
    remainingRef.current = value;
    listenersRef.current.forEach((fn) => fn());
  }, []);
  const clock = useMemo<ExamClockStore>(
    () => ({
      get: () => remainingRef.current,
      subscribe: (fn: () => void) => {
        listenersRef.current.add(fn);
        return () => listenersRef.current.delete(fn);
      },
    }),
    [],
  );
  /** Hết giờ: chỉ cho phép gọi nộp bài TỰ ĐỘNG đúng một lần, kể cả khi lần gọi trước lỗi. */
  const firedRef = useRef(false);
  /** Chênh lệch giờ máy chủ - giờ máy người dùng (ms). */
  const offsetRef = useRef(0);

  const canRef = useRef(opts.canAutoSubmit);
  const onTimeUpRef = useRef(opts.onTimeUp);
  canRef.current = opts.canAutoSubmit;
  onTimeUpRef.current = opts.onTimeUp;

  const { expiresAt, serverNow, active } = opts;

  useEffect(() => {
    if (!active || !expiresAt || !serverNow) return;
    const end = new Date(expiresAt).getTime();
    offsetRef.current = new Date(serverNow).getTime() - Date.now();
    let stopped = false;

    const tick = () => {
      const left = Math.max(0, Math.round((end - (Date.now() + offsetRef.current)) / 1000));
      setRemaining(left);
      if (left === 0 && !firedRef.current && canRef.current()) {
        // Chống gọi lặp: mỗi phiên chỉ tự động nộp một lần duy nhất.
        firedRef.current = true;
        setTimeUp(true);
        onTimeUpRef.current();
      }
    };

    /** Hỏi lại giờ máy chủ để tính lại offset (máy sleep / người dùng chỉnh giờ). */
    const resync = async () => {
      try {
        const sentAt = Date.now();
        const res = await getServerTime();
        if (stopped || !res?.now) return;
        // Bù một nửa thời gian đi-về để offset sát thực tế hơn.
        const rtt = Date.now() - sentAt;
        offsetRef.current = new Date(res.now).getTime() + rtt / 2 - Date.now();
        tick();
      } catch {
        /* giữ nguyên offset cũ khi mạng lỗi */
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void resync();
    };

    tick();
    const t = setInterval(tick, 1000);
    const sync = setInterval(() => void resync(), RESYNC_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(t);
      clearInterval(sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [expiresAt, serverNow, active]);

  return { clock, timeUp };
}
