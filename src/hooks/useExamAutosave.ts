import { useCallback, useEffect, useRef, useState } from "react";

import type { AnswerValue } from "@/lib/questionKinds";
import { saveProgress } from "@/lib/exam.functions";
import { genesisHash, linkHash } from "@/lib/exam/hashChain";
import { inputProof } from "@/lib/exam/inputProof";
import { signWithLivenessKey } from "@/lib/exam/liveness";
import { saveMessage } from "@/lib/exam/payloadSign";

/** Nhịp lưu định kỳ và các mốc chống dồn request. */
const HEARTBEAT_MS = 12_000;
const DEBOUNCE_MS = 2_000;
/** Trần tần suất: tối đa 1 request / 5 giây. */
const MIN_INTERVAL_MS = 5_000;
const BACKOFF_MS = [2_000, 5_000, 15_000];

export type AutosaveStatus = "idle" | "saving" | "saved" | "offline" | "server-error";

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
  /** Mắt xích chuỗi băm máy chủ đang giữ (lấy khi khôi phục bài làm). */
  initialChainHead?: string | null;
};

/**
 * Autosave đáp án lên máy chủ:
 * - Chỉ gửi DELTA (những câu thay đổi kể từ lần lưu thành công gần nhất).
 * - Nhịp 12s + debounce 2s, nhưng không bao giờ quá 1 request / 5s.
 * - Gửi ngay khi tab bị ẩn (visibilitychange) và khi rời trang (pagehide) qua sendBeacon.
 * - Mất mạng: giữ hàng đợi trong bộ nhớ và sessionStorage, thử lại với backoff 2s/5s/15s.
 */
export function useExamAutosave({
  sessionId,
  submitToken,
  answers,
  enabled,
  initialSeq,
  initialChainHead,
}: Params) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  /** Bản đáp án đã được máy chủ xác nhận (mốc để tính delta). */
  const ackedRef = useRef<Record<string, AnswerValue>>({});
  const seqRef = useRef<number>(initialSeq ?? 0);
  /** Seq lớn nhất đã DÙNG để gửi (kể cả beacon chưa biết kết quả) — luôn tăng để không bị máy chủ bỏ qua. */
  const usedSeqRef = useRef<number>(initialSeq ?? 0);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const inFlightRef = useRef(false);
  const lastSentAtRef = useRef(0);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Mắt xích chuỗi băm đã được máy chủ xác nhận (chống gửi lại / ghép gói đáp án). */
  const chainHeadRef = useRef<string | null>(null);

  // Mắt xích khởi đầu gắn với đúng phiên thi.
  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    void (async () => {
      const head = initialChainHead ?? (await genesisHash(sessionId));
      if (alive && !chainHeadRef.current) chainHeadRef.current = head;
      if (alive && initialChainHead) chainHeadRef.current = initialChainHead;
    })();
    return () => {
      alive = false;
    };
  }, [initialChainHead, sessionId]);

  useEffect(() => {
    if (typeof initialSeq === "number") {
      seqRef.current = initialSeq;
      usedSeqRef.current = Math.max(usedSeqRef.current, initialSeq);
    }
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

  /** Phiên đã bị máy chủ từ chối: không gửi autosave nữa. */
  const deadRef = useRef(false);

  const flush = useCallback(async () => {
    if (!enabled || !sessionId || !submitToken || inFlightRef.current || deadRef.current) return;
    const delta = computeDelta();
    if (Object.keys(delta).length === 0) return;

    persistQueue(delta);
    inFlightRef.current = true;
    lastSentAtRef.current = Date.now();
    setStatus("saving");
    const nextSeq = Math.max(seqRef.current, usedSeqRef.current) + 1;
    usedSeqRef.current = nextSeq;
    try {
      const prevHead = chainHeadRef.current ?? (await genesisHash(sessionId));
      const chainHash = await linkHash(prevHead, nextSeq, delta);
      const at = Date.now();
      // Chữ ký bằng khoá liveness không xuất được: script gọi API ngoài trang không tạo nổi.
      const signature = await signWithLivenessKey(
        sessionId,
        saveMessage({ sessionId, seq: nextSeq, chainPrev: prevHead, delta, at }),
      );
      const res = await saveProgress({
        data: {
          sessionId,
          submitToken,
          answers: delta,
          at,
          ...(signature ? { signature } : {}),
          // Bằng chứng thao tác thật cho từng câu — máy chủ từ chối đáp án do script sinh ra.
          proofs: inputProof.collect(Object.keys(delta)),
          clientSeq: nextSeq,
          chainPrev: prevHead,
          chainHash,
        },
      });
      if (res.chainHead) chainHeadRef.current = res.chainHead;
      if (res.rejected === "rate" || res.rejected === "signature") {
        // Máy chủ từ chối gói (quá nhanh / thiếu chữ ký hợp lệ): giữ hàng đợi, thử lại chậm hơn.
        if (res.chainHead) chainHeadRef.current = res.chainHead;
        setStatus("saving");
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => void flush(), MIN_INTERVAL_MS);
        return;
      }
      if (res.rejected === "chain") {
        // Máy chủ từ chối vì gãy chuỗi (gói cũ / gửi lại): đồng bộ lại mắt xích rồi gửi lại đúng thứ tự.
        seqRef.current = Math.max(seqRef.current, Number(res.seq ?? 0));
        setStatus("saving");
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => void flush(), DEBOUNCE_MS);
        return;
      }
      const serverSeq = Number(res.seq ?? 0);
      if (serverSeq < nextSeq) {
        // Máy chủ bỏ qua gói tin (seq bị lùi): đồng bộ lại seq, GIỮ hàng đợi và thử lại.
        seqRef.current = Math.max(seqRef.current, serverSeq);
        setStatus("saving");
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => void flush(), DEBOUNCE_MS);
        return;
      }
      seqRef.current = Math.max(nextSeq, serverSeq);
      // Máy chủ giới hạn số câu MỚI mỗi lần lưu: chỉ đánh dấu đã lưu phần được xác nhận,
      // phần còn lại giữ trong hàng đợi và gửi tiếp ở lần lưu sau.
      const acceptedKeys = Array.isArray(res.accepted) ? res.accepted : Object.keys(delta);
      const acceptedDelta: Record<string, AnswerValue> = {};
      for (const key of acceptedKeys) if (key in delta) acceptedDelta[key] = delta[key]!;
      ackedRef.current = { ...ackedRef.current, ...acceptedDelta };
      const leftover = Object.keys(delta).filter((k) => !(k in acceptedDelta));
      attemptRef.current = 0;
      persistQueue({});
      if (leftover.length > 0) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => void flush(), DEBOUNCE_MS);
      }
      try {
        window.sessionStorage.setItem(seqKey(sessionId), String(seqRef.current));
      } catch {
        /* bỏ qua */
      }
      setSavedAt(new Date(res.savedAt ?? Date.now()));
      setStatus("saved");
    } catch (error) {
      // Phiên đã đóng (hết giờ / mở lượt mới nơi khác): ngừng thử lại, tránh vòng lặp lỗi.
      const message = error instanceof Error ? error.message : "";
      const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (/không hợp lệ|hết giờ/i.test(message)) {
        deadRef.current = true;
        if (timerRef.current) clearTimeout(timerRef.current);
        setStatus("server-error");
        return;
      }
      // Mất mạng hoặc máy chủ lỗi: giữ nguyên hàng đợi, thử lại theo backoff.
      attemptRef.current = Math.min(attemptRef.current + 1, BACKOFF_MS.length);
      setStatus(isOffline ? "offline" : "server-error");
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
    const beacon = async () => {
      const delta = computeDelta();
      if (Object.keys(delta).length === 0) return;
      persistQueue(delta);
      const nextSeq = (usedSeqRef.current = Math.max(seqRef.current, usedSeqRef.current) + 1);
      const prevHead = chainHeadRef.current ?? (await genesisHash(sessionId));
      const chainHash = await linkHash(prevHead, nextSeq, delta);
      const at = Date.now();
      // Gói beacon phải mang ĐỦ bằng chứng như gói thường: chuỗi băm, chữ ký, bằng chứng thao tác.
      const signature = await signWithLivenessKey(
        sessionId,
        saveMessage({ sessionId, seq: nextSeq, chainPrev: prevHead, delta, at }),
      );
      const payload = JSON.stringify({
        sessionId,
        submitToken,
        answers: delta,
        proofs: inputProof.collect(Object.keys(delta)),
        clientSeq: nextSeq,
        chainPrev: prevHead,
        chainHash,
        at,
        signature,
        reason: "beacon",
      });
      const sent =
        typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
          ? navigator.sendBeacon(
              "/api/public/exam-progress",
              new Blob([payload], { type: "application/json" }),
            )
          : false;
      // sendBeacon chỉ báo "đã xếp hàng gửi", KHÔNG bảo đảm máy chủ nhận và chấp nhận.
      // Vì vậy tuyệt đối không đánh dấu đã lưu (ackedRef) và không xoá hàng đợi ở đây;
      // lần flush kế tiếp sẽ gửi lại cùng seq, cơ chế merge theo seq của máy chủ tự dọn phần thừa.
      if (!sent) void flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void beacon();
      // Quay lại tab: đối chiếu ngay để chốt phần beacon có thể đã bị máy chủ từ chối.
      else void flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const onPageHide = () => void beacon();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [computeDelta, enabled, flush, persistQueue, sessionId, submitToken]);

  useEffect(() => () => void (timerRef.current && clearTimeout(timerRef.current)), []);

  /** Đánh dấu các đáp án đã có sẵn trên máy chủ (sau khi khôi phục) để không gửi lại thừa. */
  const markAcked = useCallback(
    (serverAnswers: Record<string, AnswerValue>, seq: number, chainHead?: string) => {
    if (chainHead) chainHeadRef.current = chainHead;
    ackedRef.current = { ...serverAnswers };
    seqRef.current = Math.max(seqRef.current, seq);
    usedSeqRef.current = Math.max(usedSeqRef.current, seqRef.current);
    },
    [],
  );

  return { status, savedAt, flush, markAcked };
}
