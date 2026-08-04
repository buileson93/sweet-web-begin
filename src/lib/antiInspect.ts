/**
 * Kỹ thuật chống dò đáp án bằng công cụ nhà phát triển (Inspect / DevTools).
 * Logic thuần tuý để test được; phần gắn sự kiện nằm ở useIntegrityWatch.
 *
 * Lưu ý: đây là lớp phòng thủ phụ. Lớp phòng thủ chính vẫn là máy chủ:
 * đề gửi xuống KHÔNG kèm đáp án đúng, đáp án đã chấm bị khoá, thời gian khoá phía máy chủ.
 */

/** Thời gian (ms) một lệnh `debugger` bị treo => DevTools đang mở. */
export const DEVTOOLS_DEBUGGER_MS = 120;
/** Nhịp kiểm tra DevTools (ms). */
export const DEVTOOLS_CHECK_MS = 1_500;

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

/** Số lần liên tiếp bẫy `debugger` phải dính thì mới coi là DevTools thật sự mở. */
export const DEVTOOLS_CONFIRM_HITS = 3;
/** Hệ số so với độ trễ nền của máy: máy yếu/giật thì ngưỡng tự nới ra. */
export const DEVTOOLS_LAG_FACTOR = 6;

/**
 * Quyết định một lần đo bẫy `debugger` có đáng tin không.
 *
 * `elapsed`  : thời gian lệnh `debugger` chiếm (ms)
 * `control`  : thời gian đo một đoạn tương đương KHÔNG có `debugger` (ms) —
 *              đại diện cho độ giật của máy (GC, CPU yếu, tab bị tiết chế).
 *
 * Máy yếu khiến cả hai phép đo cùng chậm -> không kết luận. Chỉ khi lệnh
 * `debugger` chậm hơn hẳn nền mới coi là bị treo bởi DevTools.
 */
export function isDebuggerPause(elapsed: number, control: number): boolean {
  if (!Number.isFinite(elapsed) || !Number.isFinite(control)) return false;
  const floor = Math.max(DEVTOOLS_DEBUGGER_MS, control * DEVTOOLS_LAG_FACTOR);
  return elapsed > floor;
}

/** Bộ đếm xác nhận: phải dính liên tiếp `DEVTOOLS_CONFIRM_HITS` lần mới báo. */
export function createHitStreak(needed: number = DEVTOOLS_CONFIRM_HITS) {
  let streak = 0;
  return {
    push(hit: boolean): boolean {
      streak = hit ? streak + 1 : 0;
      if (streak >= needed) {
        streak = 0;
        return true;
      }
      return false;
    },
    reset() {
      streak = 0;
    },
  };
}
