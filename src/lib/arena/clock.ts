/**
 * Hiệu chỉnh lệch đồng hồ (clock skew) giữa trình duyệt và máy chủ.
 *
 * Mỗi lần đồng bộ trạng thái ta có: thời điểm gửi (client), thời điểm nhận (client)
 * và mốc `serverNow` do máy chủ trả về. Giả định đường đi và đường về cân nhau,
 * thời điểm máy chủ ứng với giữa hành trình là `serverNow + rtt/2`.
 * Từ đó suy ra độ lệch = (thời gian máy chủ) − (thời gian client tại lúc nhận).
 *
 * Dùng trung bình trượt (EWMA) để chống nhiễu mạng, và bỏ qua mẫu có RTT quá lớn
 * vì mẫu đó thường lệch nhiều (mạng chập chờn, tab bị treo).
 */

export type ClockSample = {
  /** Date.now() ngay trước khi gửi yêu cầu. */
  sentAt: number;
  /** Date.now() ngay khi nhận được phản hồi. */
  receivedAt: number;
  /** Mốc thời gian máy chủ (ms) lấy từ trường serverNow. */
  serverNow: number;
};

/** Độ lệch của MỘT mẫu: dương nghĩa là đồng hồ máy chủ đang chạy trước client. */
export function sampleSkew(sample: ClockSample): number {
  const rtt = Math.max(0, sample.receivedAt - sample.sentAt);
  return sample.serverNow + rtt / 2 - sample.receivedAt;
}

/** Bỏ qua mẫu quá xấu (RTT lớn) để không kéo lệch cả bộ ước lượng. */
export const MAX_TRUSTED_RTT_MS = 3000;

export type ClockSync = {
  /** Nạp một mẫu mới, trả về độ lệch đã làm mượt (ms). */
  push: (sample: ClockSample) => number;
  /** Độ lệch hiện tại (ms), 0 khi chưa có mẫu nào. */
  skew: () => number;
  /** RTT gần nhất (ms), null khi chưa đo được. */
  rtt: () => number | null;
  /** Số mẫu đã dùng. */
  samples: () => number;
  /** Đổi mốc thời gian máy chủ (ms) sang mốc đồng hồ client. */
  toClient: (serverMs: number) => number;
  /** "Bây giờ" theo đồng hồ máy chủ. */
  serverNow: (clientNow?: number) => number;
};

export function createClockSync(alpha = 0.3): ClockSync {
  let skew = 0;
  let count = 0;
  let lastRtt: number | null = null;

  return {
    push(sample) {
      const rtt = Math.max(0, sample.receivedAt - sample.sentAt);
      lastRtt = rtt;
      if (rtt > MAX_TRUSTED_RTT_MS && count > 0) return skew;
      const next = sampleSkew(sample);
      // Mẫu đầu tiên lấy nguyên; các mẫu sau làm mượt dần.
      skew = count === 0 ? next : skew + alpha * (next - skew);
      count += 1;
      return skew;
    },
    skew: () => skew,
    rtt: () => lastRtt,
    samples: () => count,
    toClient: (serverMs) => serverMs - skew,
    serverNow: (clientNow = Date.now()) => clientNow + skew,
  };
}

/**
 * Chống nhận sự kiện trùng hoặc sai thứ tự: chỉ chấp nhận phiên bản LỚN HƠN
 * phiên bản đang hiển thị. Bằng nhau = trùng, nhỏ hơn = tới muộn (out-of-order).
 */
export function classifyVersion(
  currentVersion: number,
  incomingVersion: number,
): "apply" | "duplicate" | "stale" {
  if (currentVersion < 0) return "apply";
  if (incomingVersion > currentVersion) return "apply";
  if (incomingVersion === currentVersion) return "duplicate";
  return "stale";
}
