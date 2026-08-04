import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";

import { reportEvent } from "@/lib/exam.functions";
import {
  DEVTOOLS_CHECK_MS,
  createConsoleBait,
  createHitStreak,
  isDebuggerPause,
  isInspectShortcut,
} from "@/lib/antiInspect";
import {
  MAX_EXEMPT_EVENTS_PER_SESSION,
  TAB_HIDDEN_MIN_MS,
  WINDOW_BLUR_MIN_MS,
  isQuotaExempt,
} from "@/lib/integrity";

/** Số sự kiện tối đa gửi lên máy chủ cho MỖI LOẠI (loại được miễn quota không tính). */
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
  /** Phát hiện mở công cụ nhà phát triển (Inspect). */
  onDevtools?: () => void;
}) {
  const runReportEvent = useServerFn(reportEvent);
  const { sessionId, submitToken, active } = opts;

  const submittedRef = useRef(opts.isSubmitted);
  const violationRef = useRef(opts.onHiddenViolation);
  const devtoolsRef = useRef<() => void>(() => {});
  submittedRef.current = opts.isSubmitted;
  violationRef.current = opts.onHiddenViolation;
  devtoolsRef.current = opts.onDevtools ?? (() => {});

  useEffect(() => {
    if (!active || !sessionId || !submitToken) return;
    const sentByKind = new Map<string, number>();
    let sentExempt = 0;
    let hiddenAt = 0;
    let hiddenReported = false;
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
    let blurTimer: ReturnType<typeof setTimeout> | null = null;
    let lastSentAt = 0;

    const report = (kind: string, detail: Record<string, unknown> = {}) => {
      if (submittedRef.current()) return;
      const exempt = isQuotaExempt(kind);
      // Quota tách riêng: rời tab / mở nhiều tab luôn được ghi nhận, không bị "đốt" bởi copy/paste.
      const sentOfKind = sentByKind.get(kind) ?? 0;
      // Quota theo TỪNG LOẠI: copy/paste bấm nhiều không còn chặn được các loại khác.
      if (exempt ? sentExempt >= MAX_EXEMPT_EVENTS_PER_SESSION : sentOfKind >= MAX_EVENTS) return;
      const now = Date.now();
      if (!exempt && now - lastSentAt < 800) return; // debounce (không áp cho loại nặng)
      lastSentAt = now;
      if (exempt) sentExempt += 1;
      else sentByKind.set(kind, sentOfKind + 1);
      void runReportEvent({
        data: { sessionId, submitToken, kind, detail },
      }).catch(() => undefined);
    };

    const clearHiddenTimer = () => {
      if (hiddenTimer) clearTimeout(hiddenTimer);
      hiddenTimer = null;
    };
    const clearBlurTimer = () => {
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = null;
    };

    /** Ghi nhận NGAY khi vừa chạm ngưỡng, không chờ thí sinh quay lại. */
    const startHidden = () => {
      if (hiddenAt) return;
      hiddenAt = Date.now();
      hiddenReported = false;
      clearHiddenTimer();
      hiddenTimer = setTimeout(() => {
        hiddenReported = true;
        report("tab_hidden", { hiddenMs: TAB_HIDDEN_MIN_MS, pending: true });
      }, TAB_HIDDEN_MIN_MS);
    };

    const endHidden = () => {
      clearHiddenTimer();
      if (!hiddenAt) return;
      const hiddenMs = Date.now() - hiddenAt;
      hiddenAt = 0;
      if (hiddenMs < TAB_HIDDEN_MIN_MS) return;
      // Đã ghi nhận lúc chạm ngưỡng: chỉ ghi bổ sung khi rời đi quá lâu.
      if (hiddenReported && hiddenMs <= 15_000) {
        violationRef.current();
        return;
      }
      report("tab_hidden", { hiddenMs });
      violationRef.current();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") startHidden();
      else endHidden();
    };
    const onPageHide = () => startHidden();
    const onBlur = () => {
      if (document.visibilityState === "hidden") {
        startHidden();
        return;
      }
      // Trang vẫn hiển thị (bàn phím ảo, thanh địa chỉ): chỉ ghi nhận nếu mất focus kéo dài.
      clearBlurTimer();
      const startedAt = Date.now();
      blurTimer = setTimeout(() => {
        if (document.hasFocus?.()) return;
        report("window_blur", {
          documentVisible: document.visibilityState === "visible",
          blurredMs: Date.now() - startedAt,
        });
      }, WINDOW_BLUR_MIN_MS);
    };
    const onFocus = () => {
      clearBlurTimer();
      endHidden();
    };
    const block = (e: Event) => {
      e.preventDefault();
      if (e.type === "copy" || e.type === "cut") report("copy");
      else if (e.type === "paste") report("paste");
      else report("contextmenu");
    };
    const blockKeys = (e: KeyboardEvent) => {
      if (isInspectShortcut(e)) {
        e.preventDefault();
        reportDevtools("shortcut");
        return;
      }
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

    /* --- Chống dò đáp án bằng Inspect / DevTools --- */
    // KHÔNG dùng kích thước cửa sổ để kết luận: sidebar trình duyệt, thanh dịch,
    // zoom hay thanh công cụ đều làm khung nhìn hẹp đi y hệt DevTools -> phạt oan.
    let devtoolsReported = false;
    let softReported = false;
    const reportDevtools = (via: string) => {
      // "Mềm" = chỉ suy đoán (mồi console chưa được xác nhận): ghi log để rà soát,
      // KHÔNG trừ liêm chính, KHÔNG huỷ bài.
      const soft = via === "console_bait";
      if (soft ? softReported : devtoolsReported) return;
      if (soft) softReported = true;
      else devtoolsReported = true;
      report("devtools_open", { via });
      if (!soft) devtoolsRef.current();
    };

    /** Bẫy `debugger`: khi DevTools mở, lệnh này bị treo lại vài trăm ms. */
    const probeDebugger = (): boolean => {
      const t0 = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      return performance.now() - t0 > DEVTOOLS_DEBUGGER_MS;
    };
    // Bẫy "mồi console": bắt được cả khi DevTools đã mở SẴN trước lúc vào phòng thi
    // và thí sinh đã tắt breakpoint (bẫy `debugger` khi đó im lặng).
    const consoleBait = createConsoleBait();
    const checkDevtools = () => {
      if (submittedRef.current()) return;
      // Mồi console có thể dính oan (tiện ích mở rộng ghi đè console)
      // -> phải có bẫy `debugger` xác nhận mới phạt.
      const baitHit = consoleBait.probe();
      if (probeDebugger()) {
        reportDevtools(baitHit ? "console_bait+debugger" : "debugger");
        return;
      }
      if (baitHit) reportDevtools("console_bait");
    };

    const devtoolsTimer = setInterval(checkDevtools, DEVTOOLS_CHECK_MS);
    checkDevtools();

    // Chặn React DevTools soi state của phòng thi (đáp án đã chọn, phản hồi tức thì).
    const hookKey = "__REACT_DEVTOOLS_GLOBAL_HOOK__";
    const win = window as unknown as Record<string, unknown>;
    const prevHook = win[hookKey];
    try {
      win[hookKey] = {
        isDisabled: true,
        supportsFiber: true,
        inject: () => undefined,
        onCommitFiberRoot: () => undefined,
        onCommitFiberUnmount: () => undefined,
        renderers: new Map(),
      };
    } catch {
      /* trình duyệt chặn ghi đè: bỏ qua */
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("paste", block);
    document.addEventListener("keydown", blockKeys);
    window.addEventListener("beforeunload", warn);

    return () => {
      clearHiddenTimer();
      clearBlurTimer();
      clearInterval(devtoolsTimer);
      try {
        win[hookKey] = prevHook;
      } catch {
        /* bỏ qua */
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("paste", block);
      document.removeEventListener("keydown", blockKeys);
      window.removeEventListener("beforeunload", warn);
    };
  }, [active, sessionId, submitToken, runReportEvent]);
}
