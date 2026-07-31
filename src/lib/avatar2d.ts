import { createAvatar } from "@dicebear/core";
import { notionists, notionistsNeutral, personas, initials } from "@dicebear/collection";

/**
 * Avatar 2D dạng SVG dựng ngay tại trình duyệt (không gọi mạng, không WebGL).
 * Mỗi nhân vật được mô tả bằng chuỗi gọn: `2d:<phong-cách>:<hạt-giống>`.
 */
export const AVATAR_STYLES = [
  { id: "notionists", label: "Công sở nét vẽ", style: notionists },
  { id: "notionists-neutral", label: "Chân dung tối giản", style: notionistsNeutral },
  { id: "personas", label: "Đồng nghiệp vui vẻ", style: personas },
  { id: "initials", label: "Chữ cái tên", style: initials },
] as const;

export type AvatarStyleId = (typeof AVATAR_STYLES)[number]["id"];

export const DEFAULT_STYLE: AvatarStyleId = "notionists";

/** Bảng màu nền hợp với tông xanh hàng không của web. */
export const AVATAR_BACKGROUNDS = ["dbeafe", "e0f2fe", "e2e8f0", "dcfce7", "fef3c7", "fae8ff"];

export type AvatarSpec = { style: AvatarStyleId; seed: string; background: string };

/** Ghép mô tả nhân vật thành chuỗi lưu trong hồ sơ. */
export function encodeAvatar(spec: AvatarSpec) {
  return `2d:${spec.style}:${spec.background}:${encodeURIComponent(spec.seed)}`;
}

/** Đọc chuỗi mô tả; chuỗi lạ (hoặc rỗng) sẽ rơi về nhân vật mặc định theo tên. */
export function decodeAvatar(value: string | undefined, fallbackSeed = "VATM"): AvatarSpec {
  const parts = (value ?? "").split(":");
  if (parts[0] === "2d" && parts.length >= 4) {
    const style = AVATAR_STYLES.some((s) => s.id === parts[1]) ? (parts[1] as AvatarStyleId) : DEFAULT_STYLE;
    return { style, background: parts[2] || AVATAR_BACKGROUNDS[0], seed: decodeURIComponent(parts.slice(3).join(":")) };
  }
  return { style: DEFAULT_STYLE, background: AVATAR_BACKGROUNDS[0], seed: fallbackSeed };
}

/** Có phải chuỗi mô tả avatar 2D hợp lệ không. */
export function isAvatar2d(value: string | undefined) {
  return typeof value === "string" && value.startsWith("2d:") && value.split(":").length >= 4;
}

/** Dựng ảnh SVG (data URI) cho một mô tả nhân vật. */
export function avatarDataUri(spec: AvatarSpec) {
  const entry = AVATAR_STYLES.find((s) => s.id === spec.style) ?? AVATAR_STYLES[0];
  return createAvatar(entry.style as never, {
    seed: spec.seed,
    backgroundColor: [spec.background],
    radius: 50,
    scale: 92,
  }).toDataUri();
}

/** Danh sách hạt giống gợi ý để người dùng bấm chọn nhanh. */
export function suggestSeeds(base: string, count = 12) {
  const clean = (base || "VATM").trim();
  return Array.from({ length: count }, (_, i) => (i === 0 ? clean : `${clean}-${i}`));
}
