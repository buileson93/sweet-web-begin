import { useCallback, useEffect, useRef, useState } from "react";

import type { AnswerValue } from "@/lib/questionKinds";
import { saveProgress } from "@/lib/exam.functions";

/** Nhịp lưu định kỳ và các mốc chống dồn request. */
const HEARTBEAT_MS = 12_000;
const DEBOUNCE_MS = 2_000;
/** Trần tần suất: tối đa 1 request / 5 giây. */
const MIN_INTERVAL_MS = 5_000;
const BACKOFF_MS = [2_000, 5_000, 15_000];

export type AutosaveStatus = "idle" | "saving" | "saved" | "offline";

export const pendingKey = (sessionId: string) => "exam:pending:" + sessionId;
export const seqKey = (sessionId: string) => "exam:seq:" + sessionId;

const same = (a: AnswerValue | undefined, b: AnswerValue | undefined) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

type Params = {
  sessionId: string | null;
  submitToken: string | null;
  answers: Record<string, AnswerValue>;
  /** Tắt autosave khi đã nộp bài hoặc hết giờ. */
  enabled: boolean;
  /** Seq khởi đầu (lấy từ máy chủ sau khi hợp nhất bài làm). */
  initialSeq?: number;
};

/**
 * Autosave đáp án lên máy chủ:
 * - Chỉ gửi DELTA (những câu thay đổi kể từ lần lưu thành công gần nhất).
 * - Nhịp 12s + debounce 2s, nhưng không bao giờ quá 1 request / 5s.
 * - Gửi ngay khi tab bị ẩn (visibilitychange) và khi rời trang (pagehide) qua sendBeacon.
 * - Mất mạng: giữ hàng đợi trong bộ nhớ và sessionStorage, thử lại với backoff 2s/5s/15s.
 */
export function useExamAutosave({ sessionId, submitToken, answers, enabled, initialSeq }: Params) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  /** Bản đáp án đã được máy chủ xác nhận (mốc để tính delta). */
  const ackedRef = useRef<Record<string, AnswerValue>>({});
  const seqRef = useRef<number>(initialSeq ?? 0);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const inFlightRef = useRef(false);
  const lastSentAtRef = useRef(0);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof initialSeq === "number") seqRef.current = initialSeq;
  }, [initialSeq]);

  /** Tính phần đáp án thay đổi so với bản máy chủ đã xác nhận. */
  const computeDelta = useCallback(() => {
    const delta: Record<string, AnswerValue> = {};
    for (const [k, v] of Object.entries(answersRef.current)) {
      if (!same(ackedRef.current[k], v)) delta[k] = v;
    }
    return delta;
  }, []);

  /** Ghi hàng đợi xuống sessionStorage để không mất khi F5 lúc đang offline. */
  const persistQueue = useCallback(
    (delta: Record<string, AnswerValue>) => {
      if (!sessionId || typeof window === "undefined") return;
      try {
        if (Object.keys(delta).length === 0)
          window.sessionStorage.removeItem(pendingKey(sessionId));
        else window.sessionStorage.setItem(pendingKey(sessionId), JSON.stringify(delta));
      } catch {
        /* bỏ qua khi trình duyệt chặn lưu trữ */
      }
    },
    [sessionId],
  );

  const flush = useCallback(async () => {
    if (!enabled || !sessionId || !submitToken || inFlightRef.current) return;
    const delta = computeDelta();
    if (Object.keys(delta).length === 0) return;

    persistQueue(delta);
    inFlightRef.current = true;
    lastSentAtRef.current = Date.now();
    setStatus("saving");
    const nextSeq = seqRef.current + 1;
    try {
      const res = await saveProgress({
        data: { sessionId, submitToken, answers: delta, clientSeq: nextSeq },
      });
      seqRef.current = Math.max(nextSeq, res.seq ?? nextSeq);
      ackedRef.current = { ...ackedRef.current, ...delta };
      attemptRef.current = 0;
      persistQueue({});
      try {
        window.sessionStorage.setItem(seqKey(sessionId), String(seqRef.current));
      } catch {
        /* bỏ qua */
      }
      setSavedAt(new Date(res.savedAt ?? Date.now()));
      setStatus("saved");
    } catch {
      // Mất mạng hoặc máy chủ lỗi: giữ nguyên hàng đợi, thử lại theo backoff.
      attemptRef.current = Math.min(attemptRef.current + 1, BACKOFF_MS.length);
      setStatus("offline");
      const wait = BACKOFF_MS[attemptRef.current - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), wait);
    } finally {
      inFlightRef.current = false;
    }
  }, [computeDelta, enabled, persistQueue, sessionId, submitToken]);

  /** Lên lịch gửi: debounce 2s nhưng tôn trọng trần 1 request / 5s. */
  const schedule = useCallback(() => {
    if (!enabled) return;
    const since = Date.now() - lastSentAtRef.current;
    const wait = Math.max(DEBOUNCE_MS, MIN_INTERVAL_MS - since);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), wait);
  }, [enabled, flush]);

  // Thay đổi đáp án -> lên lịch lưu (gộp nhiều thay đổi liên tiếp thành một request).
  useEffect(() => {
    if (!enabled) return;
    schedule();
  }, [answers, enabled, schedule]);

  // Nhịp tim 12 giây: đảm bảo bài làm luôn được đẩy lên dù người dùng ngồi im.
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => void flush(), HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [enabled, flush]);

  // Có mạng trở lại -> thử gửi ngay.
  useEffect(() => {
    if (!enabled) return;
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [enabled, flush]);

  // Tab bị ẩn hoặc rời trang: gửi ngay bằng sendBeacon (request vẫn đi khi trang đã đóng).
  useEffect(() => {
    if (!enabled || !sessionId || !submitToken) return;
    const beacon = () => {
      const delta = computeDelta();
      if (Object.keys(delta).length === 0) return;
      persistQueue(delta);
      const payload = JSON.stringify({
        sessionId,
        submitToken,
        answers: delta,
        clientSeq: seqRef.current + 1,
      });
      const sent =
        typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
          ? navigator.sendBeacon(
              "/api/public/exam-progress",
              new Blob([payload], { type: "application/json" }),
            )
          : false;
      if (sent) {
        seqRef.current += 1;
        ackedRef.current = { ...ackedRef.current, ...delta };
        persistQueue({});
      } else {
        void flush();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") beacon();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", beacon);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", beacon);
    };
  }, [computeDelta, enabled, flush, persistQueue, sessionId, submitToken]);

  useEffect(() => () => void (timerRef.current && clearTimeout(timerRef.current)), []);

  /** Đánh dấu các đáp án đã có sẵn trên máy chủ (sau khi khôi phục) để không gửi lại thừa. */
  const markAcked = useCallback((serverAnswers: Record<string, AnswerValue>, seq: number) => {
    ackedRef.current = { ...serverAnswers };
    seqRef.current = Math.max(seqRef.current, seq);
  }, []);

  return { status, savedAt, flush, markAcked };
}
