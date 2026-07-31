/** Tiện ích đếm ngược tới thời điểm mở cuộc thi. */

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Đã tới hạn hay chưa. */
  done: boolean;
};

/** Tách số mili giây còn lại thành ngày/giờ/phút/giây (không âm). */
export function countdownParts(msLeft: number): CountdownParts {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    done: total <= 0,
  };
}

/** Chuỗi đếm ngược tiếng Việt, ví dụ "2 ngày 03:14:05". */
export function formatCountdown(msLeft: number): string {
  const p = countdownParts(msLeft);
  if (p.done) return "Đã tới giờ";
  const clock = [p.hours, p.minutes, p.seconds].map((n) => String(n).padStart(2, "0")).join(":");
  return p.days > 0 ? `${p.days} ngày ${clock}` : clock;
}

/** Số mili giây còn lại tới mốc thời gian ISO; null nếu không có mốc. */
export function msUntil(iso: string | null | undefined, now: number = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return t - now;
}
