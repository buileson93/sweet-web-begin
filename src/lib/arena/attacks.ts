/**
 * Bảng tra ĐÒN ĐÁNH theo lớp + lượt — dùng chung cho hiệu ứng hình (ClassFx)
 * và con số sát thương bay lên (DuelFighter) để hình và chữ luôn khớp nhau.
 *
 * Thứ tự các bước PHẢI khớp với ClassFx.
 */
export type AttackInfo = { key: string; icon: string; label: string };

const TABLE: Record<string, AttackInfo[]> = {
  kiem_si: [
    { key: "slash", icon: "⚔️", label: "Chém chéo" },
    { key: "thrust", icon: "🗡️", label: "Đâm xoáy" },
    { key: "spin", icon: "🌀", label: "Chém xoay" },
  ],
  phap_su: [
    { key: "fire", icon: "🔥", label: "Cầu lửa" },
    { key: "ice", icon: "❄️", label: "Cầu băng" },
    { key: "bolt", icon: "⚡", label: "Tia sét" },
  ],
  ve_binh: [
    { key: "bash", icon: "🛡️", label: "Đập khiên" },
    { key: "charge", icon: "💨", label: "Húc vai" },
    { key: "stomp", icon: "🪨", label: "Giậm đất" },
  ],
};

export function attackInfo(classId: string | null | undefined, variant = 0): AttackInfo {
  const list = TABLE[classId ?? ""] ?? TABLE["ve_binh"]!;
  return list[Math.abs(variant) % list.length]!;
}
