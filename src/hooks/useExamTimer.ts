import { useEffect, useRef, useState } from "react";

/**
 * Đồng hồ đếm ngược theo thời gian máy chủ (bù chênh lệch giờ máy người dùng).
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
  const [remaining, setRemaining] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  /** Hết giờ: chỉ cho phép gọi nộp bài TỰ ĐỘNG đúng một lần, kể cả khi lần gọi trước lỗi. */
  const firedRef = useRef(false);

  const canRef = useRef(opts.canAutoSubmit);
  const onTimeUpRef = useRef(opts.onTimeUp);
  canRef.current = opts.canAutoSubmit;
  onTimeUpRef.current = opts.onTimeUp;

  const { expiresAt, serverNow, active } = opts;

  useEffect(() => {
    if (!active || !expiresAt || !serverNow) return;
    const end = new Date(expiresAt).getTime();
    const offset = new Date(serverNow).getTime() - Date.now();
    const tick = () => {
      const left = Math.max(0, Math.round((end - (Date.now() + offset)) / 1000));
      setRemaining(left);
      if (left === 0 && !firedRef.current && canRef.current()) {
        // Chống gọi lặp: mỗi phiên chỉ tự động nộp một lần duy nhất.
        firedRef.current = true;
        setTimeUp(true);
        onTimeUpRef.current();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt, serverNow, active]);

  return { remaining, timeUp };
}
