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

/** Tuỳ chọn chi tiết: khoá là thuộc tính DiceBear, giá trị là biến thể hoặc "off" (tắt), "auto" (ngẫu nhiên theo tên). */
export type AvatarOptions = Record<string, string>;

export type AvatarSpec = { style: AvatarStyleId; seed: string; background: string; options?: AvatarOptions };

/** Nhãn tiếng Việt cho từng nhóm tuỳ chỉnh của DiceBear. */
const OPTION_LABELS: Record<string, string> = {
  hair: "Kiểu tóc",
  beard: "Râu",
  facialHair: "Râu",
  brows: "Lông mày",
  eyes: "Mắt",
  glasses: "Kính",
  lips: "Miệng",
  mouth: "Miệng",
  nose: "Mũi",
  body: "Thân người",
  bodyIcon: "Hoạ tiết áo",
  gesture: "Cử chỉ tay",
};

export type AvatarOptionGroup = { key: string; label: string; values: string[]; optional: boolean };

/** Các nhóm tuỳ chỉnh khả dụng của một phong cách (đọc thẳng từ lược đồ DiceBear). */
export function optionGroups(style: AvatarStyleId): AvatarOptionGroup[] {
  const entry = AVATAR_STYLES.find((s) => s.id === style) ?? AVATAR_STYLES[0];
  const props = ((entry.style as { schema?: { properties?: Record<string, unknown> } }).schema?.properties ??
    {}) as Record<string, { items?: { enum?: string[] } }>;
  const groups: AvatarOptionGroup[] = [];
  for (const [key, def] of Object.entries(props)) {
    const values = def?.items?.enum;
    if (!Array.isArray(values) || values.length < 2) continue;
    if (!(key in OPTION_LABELS)) continue;
    groups.push({
      key,
      label: OPTION_LABELS[key],
      values: [...values].sort(),
      optional: `${key}Probability` in props,
    });
  }
  return groups.sort((a, b) => Object.keys(OPTION_LABELS).indexOf(a.key) - Object.keys(OPTION_LABELS).indexOf(b.key));
}

function encodeOptions(options?: AvatarOptions) {
  const entries = Object.entries(options ?? {}).filter(([, v]) => v && v !== "auto");
  if (entries.length === 0) return "";
  return `#${entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

function decodeOptions(raw: string): AvatarOptions {
  const options: AvatarOptions = {};
  for (const pair of raw.split("&")) {
    const [k, v] = pair.split("=");
    if (k && v) options[k] = decodeURIComponent(v);
  }
  return options;
}

/** Ghép mô tả nhân vật thành chuỗi lưu trong hồ sơ. */
export function encodeAvatar(spec: AvatarSpec) {
  return `2d:${spec.style}:${spec.background}:${encodeURIComponent(spec.seed)}${encodeOptions(spec.options)}`;
}

/** Đọc chuỗi mô tả; chuỗi lạ (hoặc rỗng) sẽ rơi về nhân vật mặc định theo tên. */
export function decodeAvatar(value: string | undefined, fallbackSeed = "VATM"): AvatarSpec {
  const [head, optionRaw] = (value ?? "").split("#");
  const parts = head.split(":");
  if (parts[0] === "2d" && parts.length >= 4) {
    const style = AVATAR_STYLES.some((s) => s.id === parts[1]) ? (parts[1] as AvatarStyleId) : DEFAULT_STYLE;
    const spec: AvatarSpec = {
      style,
      background: parts[2] || AVATAR_BACKGROUNDS[0],
      seed: decodeURIComponent(parts.slice(3).join(":")),
    };
    if (optionRaw) spec.options = decodeOptions(optionRaw);
    return spec;
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
  const groups = optionGroups(spec.style);
  const extra: Record<string, unknown> = {};
  for (const group of groups) {
    const value = spec.options?.[group.key];
    if (!value || value === "auto") continue;
    if (value === "off") {
      if (group.optional) extra[`${group.key}Probability`] = 0;
      continue;
    }
    if (!group.values.includes(value)) continue;
    extra[group.key] = [value];
    if (group.optional) extra[`${group.key}Probability`] = 100;
  }
  return createAvatar(entry.style as never, {
    seed: spec.seed,
    backgroundColor: [spec.background],
    radius: 50,
    scale: 92,
    ...extra,
  }).toDataUri();
}

/** Danh sách hạt giống gợi ý để người dùng bấm chọn nhanh. */
export function suggestSeeds(base: string, count = 12) {
  const clean = (base || "VATM").trim();
  return Array.from({ length: count }, (_, i) => (i === 0 ? clean : `${clean}-${i}`));
}


/** Nhãn hiển thị cho một biến thể (variant03 → "Kiểu 3", tên tiếng Anh → viết hoa đầu câu). */
export function optionValueLabel(value: string) {
  const m = /^variant(\d+)$/.exec(value);
  if (m) return `Kiểu ${Number(m[1])}`;
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}
