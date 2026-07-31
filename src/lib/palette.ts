/** Bảng màu giao diện — quản trị viên chọn, lưu trong trình duyệt. */

export const PALETTES = [
  { id: "aviation", label: "Xanh hàng không", swatch: ["#1D4ED8", "#38BDF8", "#FACC15"] },
  { id: "green", label: "Xanh lá học thuật", swatch: ["#1B6E4F", "#2DD4A8", "#F5F3EE"] },
  { id: "night", label: "Đêm điện tử", swatch: ["#4F46E5", "#A855F7", "#0A0A1A"] },
  { id: "emerald", label: "Ngọc lục bảo & vàng", swatch: ["#064E3B", "#C9A84C", "#F5F0E0"] },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];

export const PALETTE_STORAGE_KEY = "vatm-palette";

export function applyPalette(id: PaletteId) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.palette = id;
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, id);
  } catch {
    /* bỏ qua khi trình duyệt chặn localStorage */
  }
}

export function readPalette(): PaletteId {
  if (typeof document === "undefined") return "aviation";
  const current = document.documentElement.dataset.palette;
  if (current && PALETTES.some((p) => p.id === current)) return current as PaletteId;
  return "aviation";
}

/** Script chạy sớm để tránh nháy màu khi tải trang. */
export const PALETTE_BOOT_SCRIPT = `try{var p=localStorage.getItem('${PALETTE_STORAGE_KEY}');if(p){document.documentElement.setAttribute('data-palette',p)}}catch(e){}`;
