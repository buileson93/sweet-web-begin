/**
 * Luật phòng chờ của Đấu trường (logic THUẦN, không đụng cơ sở dữ liệu).
 *
 * Mục tiêu: chuẩn hoá một chỗ duy nhất cho câu trả lời "người này có đang bận
 * trận khác không, có được dùng lại phòng cũ không, và nếu bận thì gợi ý gì".
 * Nhờ vậy lỗi "Bạn đang ở trong một trận khác" luôn kèm theo cách thoát.
 */

/** Trạng thái phòng mà một người đang ngồi. */
export type SeatStatus = "waiting" | "countdown" | "playing";

/** Chỗ ngồi đang mở của một người (null = đang rảnh). */
export type ActiveSeat = {
  duelId: string;
  status: SeatStatus;
  /** Số người còn trong phòng (chưa rời). */
  seats: number;
} | null;

export type BusyInfo = {
  duelId: string;
  status: SeatStatus;
  /** Rời ngay không mất Elo (mới ở phòng chờ / đếm ngược). */
  freeToLeave: boolean;
  message: string;
};

/** Tiền tố để client nhận ra lỗi "đang bận" và bóc tách được mã trận. */
export const BUSY_PREFIX = "ARENA_BUSY";

const TEXT: Record<SeatStatus, string> = {
  waiting: "Bạn đang ở trong một phòng chờ khác.",
  countdown: "Phòng khác của bạn đang đếm ngược vào trận.",
  playing: "Bạn đang thi đấu ở một ván khác.",
};

/** Rời phòng chờ/đếm ngược thì không bị tính bỏ trận; đang đấu thì bị xử thua. */
export function freeToLeave(status: SeatStatus): boolean {
  return status !== "playing";
}

/** Mô tả tình trạng bận, kèm gợi ý hành động bằng tiếng Việt. */
export function busyInfo(seat: NonNullable<ActiveSeat>): BusyInfo {
  const free = freeToLeave(seat.status);
  return {
    duelId: seat.duelId,
    status: seat.status,
    freeToLeave: free,
    message: `${TEXT[seat.status]} ${
      free ? "Bạn có thể rời phòng đó ngay để tiếp tục." : "Rời lúc này sẽ bị xử thua ván đang đấu."
    }`,
  };
}

/** Đóng gói lỗi bận thành chuỗi để truyền qua server function. */
export function encodeBusyError(seat: NonNullable<ActiveSeat>): string {
  const info = busyInfo(seat);
  return `${BUSY_PREFIX}:${info.duelId}:${info.status}|${info.message}`;
}

/** Bóc tách lỗi bận ở phía client. Không phải lỗi bận thì trả về null. */
export function parseBusyError(message: string): BusyInfo | null {
  if (!message.startsWith(`${BUSY_PREFIX}:`)) return null;
  const [head, ...rest] = message.slice(BUSY_PREFIX.length + 1).split("|");
  const [duelId, status] = head.split(":");
  if (!duelId || (status !== "waiting" && status !== "countdown" && status !== "playing"))
    return null;
  return {
    duelId,
    status,
    freeToLeave: freeToLeave(status),
    message: rest.join("|") || TEXT[status],
  };
}

/** Bỏ phần kỹ thuật để hiển thị cho người dùng dù ở chỗ chưa xử lý riêng. */
export function busyText(message: string): string {
  return parseBusyError(message)?.message ?? message;
}

export type InvitePlan =
  | { action: "create" }
  | { action: "reuse"; duelId: string }
  | { action: "blocked"; reason: "in_battle" | "room_full"; busy: BusyInfo };

/**
 * Bấm "Tạo link so tài": dùng lại phòng chờ còn trống của chính mình,
 * chặn khi đang đấu hoặc phòng đã đủ hai người.
 */
export function planInviteRoom(seat: ActiveSeat): InvitePlan {
  if (!seat) return { action: "create" };
  if (seat.status !== "waiting")
    return { action: "blocked", reason: "in_battle", busy: busyInfo(seat) };
  if (seat.seats >= 2)
    return {
      action: "blocked",
      reason: "room_full",
      busy: {
        ...busyInfo(seat),
        message: "Phòng hiện tại đã đủ hai người. Chơi xong hoặc rời phòng rồi tạo link mới nhé.",
      },
    };
  return { action: "reuse", duelId: seat.duelId };
}

/** Lý do một ván không tính Elo, dùng chung cho nhãn hiển thị. */
export function rankedLabel(isRanked: boolean, note: string): { label: string; reason: string } {
  if (isRanked) return { label: "Tính Elo", reason: "Trận xếp hạng: kết quả cộng/trừ điểm Elo." };
  return {
    label: "Không tính Elo",
    reason: note.trim() || "Trận giao hữu nên kết quả không làm thay đổi điểm Elo.",
  };
}
