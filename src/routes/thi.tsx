import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ProductTour } from "@/components/ProductTour";
import { EXAM_TOUR_STEPS } from "@/components/exam/tourSteps";
import { ExamDialogs } from "@/components/exam/ExamDialogs";
import { ExamErrorScreen } from "@/components/exam/ExamErrorScreen";
import { ExamFooter } from "@/components/exam/ExamFooter";
import { ExamHeader } from "@/components/exam/ExamHeader";
import { ExamResult } from "@/components/exam/ExamResult";
import { QuestionCard } from "@/components/exam/QuestionCard";
import { QuestionMap } from "@/components/exam/QuestionMap";
import { AmbientFx } from "@/components/exam/AmbientFx";
import { ComboFx } from "@/components/exam/ComboFx";
import { AnswerFx } from "@/components/exam/AnswerFx";

import { abandonExam, startExam, submitExam } from "@/lib/exam.functions";
import type { SubmitExamResult } from "@/lib/exam.server";
import { getDeviceId } from "@/lib/deviceId";
import { EXAM_CURRENT_KEY, examKey, readExamEntry } from "@/lib/examSession";
import { useExamAnswers } from "@/hooks/useExamAnswers";
import { useExamAutosave } from "@/hooks/useExamAutosave";
import { useExamRestore } from "@/hooks/useExamRestore";
import { useExamTimer } from "@/hooks/useExamTimer";
import { useIntegrityWatch } from "@/hooks/useIntegrityWatch";
import { useLivenessWatch } from "@/hooks/useLivenessWatch";
import { isMobileDevice, leaveAllowance, shouldForceRestart } from "@/lib/integrity";
import { isAnswered } from "@/lib/questionKinds";

/** Backoff khi nộp bài thất bại vì mạng/máy chủ. */
const SUBMIT_BACKOFF_MS = [2_000, 5_000, 15_000];

export const Route = createFileRoute("/thi")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Phòng thi trực tuyến | Hội thi trắc nghiệm" },
      {
        name: "description",
        content: "Màn hình làm bài thi trắc nghiệm có tính giờ và chấm điểm tự động.",
      },
      { property: "og:title", content: "Phòng thi trực tuyến" },
      {
        property: "og:description",
        content: "Làm bài thi trắc nghiệm có tính giờ, nộp bài và nhận điểm ngay.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExamPage,
  errorComponent: ExamErrorScreen,
});

function ExamPage() {
  const navigate = useNavigate();
  const runSubmit = useServerFn(submitExam);
  const runAbandon = useServerFn(abandonExam);
  const runStart = useServerFn(startExam);

  const [result, setResult] = useState<SubmitExamResult | null>(null);
  const { session, setSession, answers, setAnswers, serverSeq, autosaveAckRef, clearLocal } =
    useExamRestore(Boolean(result));

  const [current, setCurrent] = useState(0);
  const [violations, setViolations] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [sending, setSending] = useState(false);
  /** Số lần đang thử nộp lại (0 = lần đầu) — hiển thị "đang nộp lại..." cho thí sinh. */
  const [submitRetry, setSubmitRetry] = useState(0);
  const [retaking, setRetaking] = useState(false);
  const submittedRef = useRef(false);
  const isMobileRef = useRef(false);
  const restartRef = useRef<() => Promise<void> | void>(() => {});
  useEffect(() => {
    isMobileRef.current = isMobileDevice();
  }, []);

  // Autosave đáp án lên máy chủ (delta, nhịp 12s, debounce 2s, tối đa 1 request/5s).
  const {
    status: saveStatus,
    savedAt: lastSavedAt,
    markAcked,
    flush: flushAutosave,
  } = useExamAutosave({
    sessionId: session?.sessionId ?? null,
    submitToken: session?.submitToken ?? null,
    answers,
    enabled: Boolean(session) && !result,
    initialSeq: serverSeq,
  });

  // Kiểm tra liveness liên tục bằng challenge-response (WebCrypto): phát hiện thay người giữa chừng.
  useLivenessWatch({
    sessionId: session?.sessionId ?? null,
    submitToken: session?.submitToken ?? null,
    active: Boolean(session) && !result,
  });

  // Sau khi khôi phục xong, báo cho autosave biết máy chủ đã có sẵn những đáp án nào.
  useEffect(() => {
    const ack = autosaveAckRef.current;
    if (!ack) return;
    autosaveAckRef.current = null;
    markAcked(ack.answers, ack.seq, ack.chainHead);
  }, [autosaveAckRef, markAcked, serverSeq]);

  const finish = useCallback(
    async (opts?: { disqualified?: boolean; reason?: string }) => {
      if (!session || submittedRef.current) return;
      submittedRef.current = true;
      setSending(true);
      setSubmitRetry(0);
      // Đẩy nốt phần đáp án chưa kịp lưu trước khi nộp: máy chủ chỉ chấm đáp án đã lưu
      // (mỗi request chỉ nhận thêm một số câu MỚI có hạn).
      try {
        await flushAutosave();
      } catch {
        /* mất mạng: vẫn nộp, phần đã lưu trước đó được chấm */
      }
      const payload = {
        sessionId: session.sessionId,
        // Mã nộp bài dùng một lần do máy chủ cấp khi mở phiên thi.
        submitToken: session.submitToken,
        answers,
        disqualified: opts?.disqualified,
        disqualifyReason: opts?.reason,
      };
      try {

        // Nộp bài có thử lại theo backoff 2s/5s/15s — mất mạng đúng lúc nộp là tình huống căng nhất.
        let lastError: unknown = null;
        for (let attempt = 0; attempt < SUBMIT_BACKOFF_MS.length + 1; attempt += 1) {
          try {
            const res = await runSubmit({ data: payload });
            clearLocal(session.sessionId);
            setResult(res);
            window.scrollTo({ top: 0 });
            return;
          } catch (error) {
            lastError = error;
            const message = error instanceof Error ? error.message : "";
            // Lỗi nghiệp vụ (phiên không hợp lệ, đã nộp...) thì thử lại cũng vô ích.
            if (/không hợp lệ|đã nộp|không tìm thấy/i.test(message)) break;
            const wait = SUBMIT_BACKOFF_MS[attempt];
            if (wait === undefined) break;
            setSubmitRetry(attempt + 1);
            await new Promise((r) => setTimeout(r, wait));
          }
        }
        submittedRef.current = false;
        toast.error(
          lastError instanceof Error
            ? lastError.message
            : "Nộp bài thất bại, vui lòng thử lại.",
        );
      } finally {
        setSending(false);
        setSubmitRetry(0);
      }
    },
    [answers, clearLocal, flushAutosave, runSubmit, session],
  );

  const { clock, timeUp } = useExamTimer({
    expiresAt: session?.expiresAt,
    serverNow: session?.serverNow,
    active: Boolean(session) && !result,
    canAutoSubmit: () => !submittedRef.current,
    onTimeUp: () => {
      toast.warning("Hết giờ! Hệ thống tự động nộp bài.");
      void finish();
    },
  });

  useIntegrityWatch({
    sessionId: session?.sessionId,
    submitToken: session?.submitToken,
    active: Boolean(session) && !result,
    isSubmitted: () => submittedRef.current,
    onDevtools: () =>
      toast.error(
        "Phát hiện mở công cụ nhà phát triển (Inspect). Hành vi này đã được ghi nhận cho ban tổ chức.",
      ),
    onHiddenViolation: () =>
      setViolations((v) => {
        const next = v + 1;
        if (shouldForceRestart(next, isMobileRef.current)) {
          toast.error("Bạn đã rời khỏi màn hình thi — bài thi bị huỷ và phải làm lại từ đầu.");
          void restartRef.current();
        } else {
          toast.warning(
            "Cảnh báo: rời khỏi màn hình thi. Lần tiếp theo bài thi sẽ bị huỷ và phải làm lại từ đầu.",
          );
        }
        return next;
      }),
  });

  const {
    fifty,
    fiftyBusy,
    fiftyLeft,
    requestFifty,
    x2Index,
    x2Busy,
    x2Left,
    requestX2,
    feedback,
    feedbackInfo,
    answerFx,
    combo,
    comboEvent,
    comboFx,
    instant,
    locked,
    handleAnswer,
    resetHelpers,
  } = useExamAnswers({ session, current, setCurrent, setAnswers });

  const answeredCount = useMemo(
    () =>
      session
        ? session.questions.filter((q, i) => isAnswered(q.kind, answers[String(i)])).length
        : 0,
    [answers, session],
  );

  /** Thoát phòng thi: huỷ phiên trên máy chủ rồi về trang chủ. */
  const doExit = useCallback(async () => {
    if (session) {
      submittedRef.current = true;
      try {
        await runAbandon({
          data: { sessionId: session.sessionId, submitToken: session.submitToken },
        });
      } catch {
        /* bỏ qua - vẫn cho thoát */
      }
      clearLocal(session.sessionId);
    }
    navigate({ to: "/" });
  }, [clearLocal, navigate, runAbandon, session]);

  /** Thi lại ngay: mở phiên mới với đúng thông tin đã đăng ký, không phải nhập lại. */
  const retake = useCallback(async () => {
    const entry = readExamEntry(typeof window === "undefined" ? null : window.sessionStorage);
    if (!entry) {
      navigate({ to: "/" });
      return;
    }
    setRetaking(true);
    try {
      const next = await runStart({
        data: {
          quizId: entry.quizId,
          name: entry.name,
          credential: entry.credential,
          extraCredential: entry.extraCredential,
          deviceId: getDeviceId(),
        },
      });
      sessionStorage.setItem(examKey(next.sessionId), JSON.stringify(next));
      sessionStorage.setItem(EXAM_CURRENT_KEY, next.sessionId);
      submittedRef.current = false;
      setResult(null);
      setAnswers(() => ({}));
      resetHelpers();
      setCurrent(0);
      setViolations(0);
      setSession(next);
      window.scrollTo({ top: 0 });
      toast.success("Đã mở lượt thi mới. Chúc bạn làm bài tốt!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể thi lại lúc này.");
      navigate({ to: "/" });
    } finally {
      setRetaking(false);
    }
  }, [navigate, resetHelpers, runStart, setAnswers, setSession]);

  /** Buộc thi lại từ đầu khi vi phạm rời màn hình: huỷ phiên hiện tại rồi mở phiên mới. */
  const forceRestart = useCallback(async () => {
    if (session && !submittedRef.current) {
      submittedRef.current = true;
      try {
        await runAbandon({
          data: { sessionId: session.sessionId, submitToken: session.submitToken },
        });
      } catch {
        /* bỏ qua */
      }
      clearLocal(session.sessionId);
    }
    await retake();
  }, [clearLocal, retake, runAbandon, session]);

  useEffect(() => {
    restartRef.current = forceRestart;
  }, [forceRestart]);

  if (result) return <ExamResult result={result} onRetake={retake} retaking={retaking} />;

  if (!session) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const total = session.questions.length;
  const q = session.questions[current];
  const progress = Math.round((answeredCount / total) * 100);

  return (
    <div className="no-select relative min-h-[100dvh] bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-8">
      <AmbientFx />
      <ComboFx event={comboEvent} />
      <AnswerFx event={answerFx} />
      {sending && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 backdrop-blur-sm">
          <div className="card-elevated flex flex-col items-center gap-2 rounded-2xl px-7 py-5 text-center">
            <Loader2 className="size-5 animate-spin text-accent" />
            <p className="font-heading text-sm font-bold">
              {submitRetry > 0 ? `Đang nộp lại... (lần ${submitRetry})` : "Đang chấm bài..."}
            </p>
            {submitRetry > 0 && (
              <p className="text-xs text-muted-foreground">
                Mạng đang chập chờn — hệ thống tự gửi lại, đừng tắt trang.
              </p>
            )}
          </div>
        </div>
      )}

      <ExamHeader
        quizTitle={session.quizTitle}
        answeredCount={answeredCount}
        total={total}
        combo={combo}
        showCombo={instant && comboFx && combo >= 2}
        clock={clock}
        progress={progress}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        onExit={() => setExitOpen(true)}
      />

      <ProductTour steps={EXAM_TOUR_STEPS} storageKey="tour:seen:exam:v1" />

      <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4 lg:py-6">
        {timeUp && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            Đã hết giờ, hệ thống đang nộp bài
          </div>
        )}
        {violations > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
            <AlertTriangle className="size-4 shrink-0" />
            Bạn đã rời khỏi màn hình thi {violations} lần.{" "}
            {leaveAllowance(isMobileRef.current) > 0
              ? "Rời thêm một lần nữa, bài thi sẽ bị huỷ và phải làm lại từ đầu."
              : "Bài thi sẽ bị huỷ và phải làm lại từ đầu."}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px]">
          <QuestionCard
            question={q}
            settings={session.settings}
            current={current}
            total={total}
            value={answers[String(current)]}
            removed={fifty[String(current)] ?? []}
            disabled={locked(current)}
            feedback={feedback[String(current)] ?? null}
            feedbackInfo={feedbackInfo[String(current)] ?? null}
            instant={instant}
            fiftyBusy={fiftyBusy}
            fiftyLeft={fiftyLeft}
            fiftyUsed={Boolean(fifty[String(current)])}
            x2Left={x2Left}
            x2Busy={x2Busy}
            x2Active={x2Index === current}
            onX2={() => void requestX2()}
            onFifty={() => void requestFifty()}
            onAnswer={(value) => void handleAnswer(current, value)}
            onConfirm={() => {
              const value = answers[String(current)];
              if (value !== undefined) void handleAnswer(current, value, { confirm: true });
            }}
            onPrev={() => setCurrent((c) => c - 1)}
            onNext={() => setCurrent((c) => Math.min(total - 1, c + 1))}
            onSubmit={() => setConfirmOpen(true)}
          />

          <QuestionMap
            questions={session.questions}
            answers={answers}
            feedback={feedback}
            current={current}
            open={navOpen}
            onSelect={(i) => {
              setCurrent(() => i);
              setNavOpen(false);
            }}
            onSubmit={() => setConfirmOpen(true)}
          />
        </div>
      </main>

      <ExamFooter
        current={current}
        total={total}
        onPrev={() => setCurrent((c) => c - 1)}
        onNext={() => setCurrent((c) => c + 1)}
        onSubmit={() => setConfirmOpen(true)}
        onToggleMap={() => setNavOpen((v) => !v)}
      />

      <ExamDialogs
        confirmOpen={confirmOpen}
        onConfirmOpenChange={setConfirmOpen}
        exitOpen={exitOpen}
        onExitOpenChange={setExitOpen}
        answeredCount={answeredCount}
        total={total}
        sending={sending}
        onSubmit={() => void finish()}
        onExit={() => void doExit()}
      />
    </div>
  );
}
