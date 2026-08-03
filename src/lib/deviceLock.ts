/**
 * Thông báo tiếng Việt khi thiết bị đang trong thời gian nguội
 * (vừa có nhân viên khác dự thi trên chính thiết bị này).
 * Module thuần để test được offline.
 */

/** Rút gọn họ tên thành "Nguyễn V. A" để không lộ đầy đủ danh tính. */
export function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "một thí sinh khác";
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map((p) => `${p[0].toUpperCase()}.`);
  return [...initials, last].join(" ");
}

/** Diễn giải số giây còn lại thành "x giờ y phút" / "x phút y giây". */
export function humanizeWait(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h > 0) return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
  if (m <= 0) return `${rest} giây`;
  if (rest === 0) return `${m} phút`;
  return `${m} phút ${rest} giây`;
}

export function deviceCooldownMessage(waitSeconds: number, holderName: string): string {
  return (
    `Thiết bị này vừa được ${maskName(holderName)} sử dụng để dự thi. ` +
    `Để chống thi hộ, vui lòng chờ thêm ${humanizeWait(waitSeconds)} rồi thử lại, ` +
    `hoặc dùng thiết bị khác.`
  );
}
