/**
 * Kỹ thuật chống dò đáp án bằng công cụ nhà phát triển (Inspect / DevTools).
 * Logic thuần tuý để test được; phần gắn sự kiện nằm ở useIntegrityWatch.
 *
 * Lưu ý: đây là lớp phòng thủ phụ. Lớp phòng thủ chính vẫn là máy chủ:
 * đề gửi xuống KHÔNG kèm đáp án đúng, đáp án đã chấm bị khoá, thời gian khoá phía máy chủ.
 */

/** Chênh lệch kích thước cửa sổ (px) coi như bảng DevTools đang mở dạng gắn cạnh. */
export const DEVTOOLS_SIZE_GAP = 170;
/** Thời gian (ms) một lệnh `debugger` bị treo => DevTools đang mở. */
export const DEVTOOLS_DEBUGGER_MS = 120;
/** Nhịp kiểm tra DevTools (ms). */
export const DEVTOOLS_CHECK_MS = 1_500;

export type WindowMetrics = {
  outerWidth: number;
  innerWidth: number;
  outerHeight: number;
  innerHeight: number;
};

/** DevTools gắn cạnh làm khung nhìn nhỏ hơn hẳn kích thước cửa sổ. */
export function isDevtoolsBySize(m: WindowMetrics, gap: number = DEVTOOLS_SIZE_GAP): boolean {
  const dw = m.outerWidth - m.innerWidth;
  const dh = m.outerHeight - m.innerHeight;
  if (!Number.isFinite(dw) || !Number.isFinite(dh)) return false;
  return dw > gap || dh > gap;
}

/** Phím tắt mở DevTools / xem mã nguồn cần chặn trong phòng thi. */
export function isInspectShortcut(e: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): boolean {
  const key = (e.key || "").toLowerCase();
  if (key === "f12") return true;
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return false;
  if (e.shiftKey && ["i", "j", "c", "k"].includes(key)) return true;
  if (key === "u") return true; // xem mã nguồn
  return false;
}

/** Số lần kiểm tra liên tiếp thấy khung nhìn hụt thì kết luận DevTools (≈ 6 giây). */
export const DEVTOOLS_SIZE_CONFIRM = 4;

/**
 * Bẫy "mồi console": chỉ khi bảng DevTools đang MỞ, trình duyệt mới dựng bản xem
 * trước của đối tượng in ra console và gọi vào getter/toString của mồi.
 * Bắt được cả trường hợp mở DevTools TRƯỚC khi vào phòng thi và tắt breakpoint
 * (bẫy `debugger` khi đó không kích hoạt).
 */
export function createConsoleBait(): { probe: () => boolean } {
  let hit = false;
  const markHit = () => {
    hit = true;
  };

  const bait: Record<string, unknown> = {};
  try {
    Object.defineProperty(bait, "id", {
      get() {
        markHit();
        return "";
      },
      configurable: true,
    });
  } catch {
    /* bỏ qua */
  }

  const reBait = /vatm/;
  try {
    reBait.toString = () => {
      markHit();
      return "";
    };
  } catch {
    /* bỏ qua */
  }

  return {
    probe: () => {
      hit = false;
      try {
        // In mồi rồi xoá ngay: không làm bẩn console của thí sinh.
        console.log("%c", bait, reBait);
        console.clear?.();
      } catch {
        /* bỏ qua */
      }
      return hit;
    },
  };
}
