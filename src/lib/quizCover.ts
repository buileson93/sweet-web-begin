import bookCover from "@/assets/quiz-cover-book.png";
import planeCover from "@/assets/quiz-cover-plane.png";
import towerCover from "@/assets/quiz-cover-tower.png";

/** Kho ảnh chìm dựng sẵn theo chủ đề hàng không / tri thức. */
export const COVER_PRESETS = [
  { id: "preset:tower", label: "Đài kiểm soát", src: towerCover },
  { id: "preset:plane", label: "Máy bay & mây", src: planeCover },
  { id: "preset:book", label: "Sách & tri thức", src: bookCover },
] as const;

export const QUIZ_COVER_BUCKET = "quiz-covers";

/** Băm nhẹ để mỗi cuộc thi luôn nhận cùng một ảnh mặc định. */
export function coverSeedIndex(seed: string, size: number): number {
  if (size <= 0) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % size;
}

/**
 * Đổi giá trị cover_url trong CSDL thành đường dẫn ảnh dùng được ở trình duyệt.
 * Rỗng → chọn ảnh dựng sẵn theo mã cuộc thi để thẻ nào cũng có ảnh chìm.
 */
export function resolveQuizCover(coverUrl: string | null | undefined, seed = ""): string {
  const value = (coverUrl ?? "").trim();
  if (value.startsWith("preset:")) {
    const found = COVER_PRESETS.find((p) => p.id === value);
    if (found) return found.src;
  } else if (/^https?:\/\//i.test(value)) {
    return value;
  } else if (value) {
    return `/api/public/anh-bia/${value.split("/").map(encodeURIComponent).join("/")}`;
  }
  return COVER_PRESETS[coverSeedIndex(seed, COVER_PRESETS.length)].src;
}
