export function formatSeconds(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

export function toLocalInputValue(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(d);
  return parts.replace(" ", "T");
}

export function fromLocalInputValue(value: string) {
  if (!value) return null;
  // Người dùng nhập theo giờ Việt Nam (UTC+7)
  return new Date(`${value}:00+07:00`).toISOString();
}

export type QuizStatus = "upcoming" | "open" | "closed" | "paused";

export function quizStatus(quiz: {
  is_active: boolean;
  start_time: string | null;
  end_time: string | null;
  /** Trạng thái soạn thảo: nháp / đã xuất bản / đã đóng. */
  status?: string | null;
}): QuizStatus {
  // Không cần bấm "Xuất bản": cuộc thi tự mở khi tới giờ.
  // Chỉ bản nháp và công tắc "Đang hoạt động" mới chặn thí sinh vào thi.
  if (quiz.status === "draft") return "paused";
  if (!quiz.is_active) return "paused";
  const now = Date.now();
  if (quiz.start_time && now < new Date(quiz.start_time).getTime()) return "upcoming";
  if (quiz.end_time && now > new Date(quiz.end_time).getTime()) return "closed";
  return "open";
}

export const statusLabel: Record<QuizStatus, string> = {
  upcoming: "Sắp diễn ra",
  open: "Đang mở",
  closed: "Đã kết thúc",
  paused: "Tạm dừng",
};
