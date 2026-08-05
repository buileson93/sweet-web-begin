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
export function useExamFullscreen(active: boolean) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const supported = typeof document !== "undefined" && fullscreenSupported();

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(currentFsElement()));
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

  // Rời trang thi thì luôn trả màn hình về bình thường.
  useEffect(() => {
    if (active) return;
    void exit();
  }, [active, exit]);

  useEffect(() => () => void exit(), [exit]);

  return { supported, isFullscreen, enter, exit, needsPrompt: active && supported && !isFullscreen };
}
