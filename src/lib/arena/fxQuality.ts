import { useEffect, useState } from "react";

/**
 * Chất lượng hiệu ứng: tự hạ cấp khi máy yếu / FPS thấp và tôn trọng chế độ
 * "giảm chuyển động" của hệ điều hành hoặc lựa chọn của người chơi.
 *
 * - `high` : đầy đủ hiệu ứng.
 * - `low`  : bỏ bớt hạt/hào quang, hoạt ảnh ngắn hơn.
 * - `min`  : gần như tĩnh (giảm chuyển động).
 */
export type FxQuality = "high" | "low" | "min";

const PREF_KEY = "arena:reduce-motion";

export function prefersReducedMotionPref(): boolean {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(PREF_KEY) === "1") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function setReduceMotionPref(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREF_KEY, on ? "1" : "0");
}

/** Xếp hạng chất lượng từ FPS trung bình. */
export function qualityFromFps(fps: number, reduced: boolean): FxQuality {
  if (reduced) return "min";
  if (fps < 24) return "min";
  if (fps < 45) return "low";
  return "high";
}

/**
 * Đo FPS bằng requestAnimationFrame theo cửa sổ 1 giây và hạ/nâng cấp dần.
 * Gắn thuộc tính `data-fx` lên <html> để CSS tự tắt bớt hoạt ảnh.
 */
export function useFxQuality(): FxQuality {
  const [quality, setQuality] = useState<FxQuality>("high");

  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let windowStart = performance.now();
    let stopped = false;
    // Giữ mức thấp ít nhất vài giây để không nhấp nháy qua lại.
    let lastChange = 0;

    const reduced = prefersReducedMotionPref();
    if (reduced) {
      setQuality("min");
      return;
    }

    const loop = (now: number) => {
      if (stopped) return;
      frames += 1;
      if (now - windowStart >= 1000) {
        const fps = (frames * 1000) / (now - windowStart);
        frames = 0;
        windowStart = now;
        const next = qualityFromFps(fps, false);
        setQuality((cur) => {
          if (next === cur) return cur;
          // Hạ cấp ngay, nâng cấp chỉ sau 4 giây ổn định.
          const downgrade = (cur === "high" && next !== "high") || (cur === "low" && next === "min");
          if (!downgrade && now - lastChange < 4000) return cur;
          lastChange = now;
          return next;
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset["fx"] = quality;
    return () => {
      delete document.documentElement.dataset["fx"];
    };
  }, [quality]);

  return quality;
}
