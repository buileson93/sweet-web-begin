import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";

import { reportEvent } from "@/lib/exam.functions";
import { MAX_EXEMPT_EVENTS_PER_SESSION, isQuotaExempt } from "@/lib/integrity";

/** Số sự kiện tối đa gửi lên máy chủ trong một phiên thi (không tính loại được miễn quota). */
export const MAX_EVENTS = 20;


/**
 * Ghi nhận hành vi trong phòng thi: chỉ BÁO CÁO cho máy chủ,
 * tuyệt đối không tự huỷ bài phía máy khách.
 */
export function useIntegrityWatch(opts: {
  sessionId: string | null | undefined;
  submitToken: string | null | undefined;
  active: boolean;
  /** Đã nộp bài thì ngừng gửi sự kiện. */
  isSubmitted: () => boolean;
  /** Người thi rời màn hình thi quá lâu. */
  onHiddenViolation: () => void;
}) {
  const runReportEvent = useServerFn(reportEvent);
  const { sessionId, submitToken, active } = opts;

  const submittedRef = useRef(opts.isSubmitted);
  const violationRef = useRef(opts.onHiddenViolation);
  submittedRef.current = opts.isSubmitted;
  violationRef.current = opts.onHiddenViolation;

  useEffect(() => {
    if (!active || !sessionId || !submitToken) return;
    const isTouch =
      typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
    let sent = 0;
    let sentExempt = 0;
    let hiddenAt = 0;
    let lastSentAt = 0;

    const report = (kind: string, detail: Record<string, unknown> = {}) => {
      if (submittedRef.current()) return;
      const exempt = isQuotaExempt(kind);
      // Quota tách riêng: rời tab / mở nhiều tab luôn được ghi nhận, không bị "đốt" bởi copy/paste.
      if (exempt ? sentExempt >= MAX_EXEMPT_EVENTS_PER_SESSION : sent >= MAX_EVENTS) return;
      const now = Date.now();
      if (!exempt && now - lastSentAt < 800) return; // debounce (không áp cho loại nặng)
      lastSentAt = now;
      if (exempt) sentExempt += 1;
      else sent += 1;
      void runReportEvent({
        data: { sessionId, submitToken, kind, detail },
      }).catch(() => undefined);
    };


    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const hiddenMs = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;
      // Dưới 3 giây (thông báo đẩy, cuộc gọi chớp nhoáng, xoay màn hình) thì bỏ qua hoàn toàn.
      if (hiddenMs < 3_000) return;
      report("tab_hidden", { hiddenMs });
      violationRef.current();
    };
    const onBlur = () => {
      // Trên thiết bị cảm ứng, blur xảy ra liên tục (bàn phím ảo, thanh địa chỉ) — không ghi nhận.
      if (isTouch || document.visibilityState === "hidden") return;
      report("window_blur", { documentVisible: document.visibilityState === "visible" });
    };
    const block = (e: Event) => {
      e.preventDefault();
      if (e.type === "copy" || e.type === "cut") report("copy");
      else if (e.type === "paste") report("paste");
      else report("contextmenu");
    };
    const blockKeys = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        ["c", "v", "x", "p", "s", "u"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
      }
    };
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("paste", block);
    document.addEventListener("keydown", blockKeys);
    window.addEventListener("beforeunload", warn);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("paste", block);
      document.removeEventListener("keydown", blockKeys);
      window.removeEventListener("beforeunload", warn);
    };
  }, [active, sessionId, submitToken, runReportEvent]);
}
