/**
 * Lớp thuần cho tính năng "Nhắc dự thi": dựng danh sách liên hệ để dán vào
 * Zalo/Outlook và dựng nội dung trộn thư. Không đụng DOM để kiểm thử được.
 */

export type ReminderPerson = {
  full_name: string;
  position?: string | null;
  unit_name?: string | null;
  phone?: string | null;
};

/** Hạn chót hiển thị cho người được nhắc. */
export function formatDeadline(endTime: string | null | undefined): string {
  if (!endTime) return "chưa ấn định";
  const d = new Date(endTime);
  if (Number.isNaN(d.getTime())) return "chưa ấn định";
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Danh sách "Họ tên - đơn vị - số điện thoại" mỗi người một dòng, để dán vào nhóm chat. */
export function buildContactList(people: ReminderPerson[]): string {
  return people
    .map((p) =>
      [p.full_name, p.unit_name?.trim() || null, p.phone?.trim() || null]
        .filter(Boolean)
        .join(" - "),
    )
    .join("\n");
}

/** Nội dung nhắc gửi cho một người (trộn thư). */
export function buildReminderMessage(
  person: ReminderPerson,
  quizTitle: string,
  deadline: string,
): string {
  const unit = person.unit_name?.trim();
  return (
    `Kính gửi ${person.full_name}${unit ? ` (${unit})` : ""},\n` +
    `Anh/Chị chưa tham gia "${quizTitle}". ` +
    `Đề nghị hoàn thành trước ${deadline}. Trân trọng.`
  );
}
