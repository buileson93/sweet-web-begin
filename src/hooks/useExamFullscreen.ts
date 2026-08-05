import { useCallback, useEffect, useRef, useState } from "react";

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function currentFsElement(): Element | null {
  if (typeof document === "undefined") return null;
  const doc = document as FsDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/** Thiết bị/trình duyệt có hỗ trợ toàn màn hình không (iOS Safari thì không). */
export function fullscreenSupported(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.documentElement as FsElement;
  return Boolean(el.requestFullscreen ?? el.webkitRequestFullscreen);
}

/**
 * Khoá phòng thi ở chế độ toàn màn hình: chỉ thoát khi nộp bài hoặc rời phòng thi.
 * Chỉ dùng cho trang thi trắc nghiệm (không áp dụng cho đấu trường).
 */
export function useExamFullscreen(active: boolean, onExitDetected?: () => void) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const supported = typeof document !== "undefined" && fullscreenSupported();
  const exitCbRef = useRef(onExitDetected);
  exitCbRef.current = onExitDetected;
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const sync = () => {
      const now = Boolean(currentFsElement());
      setIsFullscreen((prev) => {
        // Thoát toàn màn hình giữa chừng => ghi nhận vi phạm.
        if (prev && !now && activeRef.current) exitCbRef.current?.();
        return now;
      });
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const enter = useCallback(async () => {
    if (!supported || currentFsElement()) return true;
    const el = document.documentElement as FsElement;
    try {
      await (el.requestFullscreen?.({ navigationUI: "hide" }) ?? el.webkitRequestFullscreen?.());
      return true;
    } catch {
      return false;
    }
  }, [supported]);

  const exit = useCallback(async () => {
    if (!currentFsElement()) return;
    const doc = document as FsDocument;
    try {
      await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
    } catch {
      /* bỏ qua */
    }
  }, []);

  // Vào phòng thi thì thử bật toàn màn hình ngay (nếu trình duyệt còn giữ "user gesture").
  useEffect(() => {
    if (!active || !supported) return;
    void enter();
  }, [active, enter, supported]);

  // Thiết bị không hỗ trợ toàn màn hình (iOS Safari): chạy chế độ đắm chìm bằng CSS.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const on = active && !supported;
    document.body.classList.toggle("exam-immersive", on);
    return () => document.body.classList.remove("exam-immersive");
  }, [active, supported]);

  // Rời trang thi thì luôn trả màn hình về bình thường.
  useEffect(() => {
    if (active) return;
    void exit();
  }, [active, exit]);

  useEffect(() => () => void exit(), [exit]);

  return { supported, isFullscreen, enter, exit, needsPrompt: active && supported && !isFullscreen };
}
