import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Flame,
  Loader2,
  LogOut,
  Radio,
  RefreshCw,
  Send,
  Sparkles,
  Timer,
  TrendingUp,
  Wand2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { questionImageSrc } from "@/lib/questionImage";
import { ProductTour, type TourStep } from "@/components/ProductTour";
import { QuestionInput } from "@/components/exam/QuestionInput";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useRealtimeResults } from "@/hooks/useRealtimeResults";
import {
  abandonExam,
  checkAnswer,
  requestFiftyFifty,
  startExam,
  submitExam,
  loadProgress,
} from "@/lib/exam.functions";
import type { StartExamResult, SubmitExamResult } from "@/lib/exam.server";
import {
  EXAM_CURRENT_KEY,
  examKey,
  mergeAnswers,
  readExamEntry,
  restoreExamSession,
} from "@/lib/examSession";
import { useExamAutosave, seqKey } from "@/hooks/useExamAutosave";

/** Khoá lưu đáp án tạm trên máy (giữ bài khi F5 hoặc mất mạng). */
const localAnswersKey = (sessionId: string) => "exam:answers:" + sessionId;

import { isAnswered, KIND_LABEL, type AnswerValue } from "@/lib/questionKinds";
import { formatSeconds } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Celebration } from "@/components/Celebration";

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

/** Màn hình dự phòng khi phòng thi gặp lỗi — luôn có lối thoát thay vì trắng màn hình. */
function ExamErrorScreen({ error }: { error: unknown }) {
  const navigate = useNavigate();
  const message = error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.";
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background px-[calc(1rem+env(safe-area-inset-left))] py-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="card-elevated w-full max-w-md p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" />
        </span>
        <h1 className="type-h2 mt-4">Phòng thi gặp sự cố</h1>
        <p className="type-muted mt-2">
          Dữ liệu lượt thi không hợp lệ hoặc đã hết hạn. Bạn có thể bắt đầu lại một lượt thi mới.
        </p>
        <p className="type-meta mt-3 line-clamp-3 rounded-xl bg-secondary px-3 py-2 text-left">
          {message}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            className="rounded-full"
            onClick={() => {
              try {
                sessionStorage.clear();
              } catch {
                /* bỏ qua */
              }
              navigate({ to: "/" });
            }}
          >
            <RefreshCw className="size-4" /> Bắt đầu lượt thi mới
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => window.location.reload()}
          >
            Tải lại trang
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Các bước giới thiệu nhanh giao diện phòng thi cho người thi lần đầu. */
const EXAM_TOUR_STEPS: TourStep[] = [
  {
    target: "exam-question",
    title: "Nội dung câu hỏi",
    description:
      "Đề bài và hình minh hoạ (nếu có) hiển thị tại đây. Câu hỏi được trộn ngẫu nhiên cho mỗi lượt thi.",
  },
  {
    target: "exam-options",
    title: "Chọn đáp án",
    description:
      "Bấm vào một phương án để chọn. Bạn có thể đổi đáp án bất cứ lúc nào trước khi nộp bài.",
  },
  {
    target: "exam-nav",
    title: "Danh sách câu hỏi",
    description: "Ô sáng màu là câu đã trả lời. Bấm số thứ tự để nhảy nhanh tới câu bất kỳ.",
  },
];

const MAX_VIOLATIONS = 3;

function ExamPage() {
  const navigate = useNavigate();
  const runSubmit = useServerFn(submitExam);
  const runFifty = useServerFn(requestFiftyFifty);
  const runCheck = useServerFn(checkAnswer);
  const runAbandon = useServerFn(abandonExam);
  const runStart = useServerFn(startExam);
  const runLoadProgress = useServerFn(loadProgress);

  const [session, setSession] = useState<StartExamResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [fifty, setFifty] = useState<Record<string, number[]>>({});
  const [fiftyBusy, setFiftyBusy] = useState(false);
  /** Phản hồi tức thì cho từng câu (chỉ ở chế độ chốt đáp án một lần). */
  const [feedback, setFeedback] = useState<Record<string, "correct" | "wrong">>({});
  const [combo, setCombo] = useState(0);

  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [violations, setViolations] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [result, setResult] = useState<SubmitExamResult | null>(null);
  const [sending, setSending] = useState(false);
  const [retaking, setRetaking] = useState(false);
  const submittedRef = useRef(false);
  /** Hết giờ: chỉ cho phép gọi nộp bài TỰ ĐỘNG đúng một lần, kể cả khi lần gọi trước lỗi. */
  const timeUpRef = useRef(false);
  const [timeUp, setTimeUp] = useState(false);
  /** Seq autosave lấy từ máy chủ sau khi khôi phục bài làm. */
  const [serverSeq, setServerSeq] = useState(0);
  const autosaveAckRef = useRef<{ answers: Record<string, AnswerValue>; seq: number } | null>(null);

  useEffect(() => {
    const restored = restoreExamSession(
      typeof window === "undefined" ? null : window.sessionStorage,
    );
    if (!restored) {
      navigate({ to: "/" });
      return;
    }
    setSession(restored);

    // Khôi phục bài làm: hợp nhất đáp án lưu trên máy với đáp án đã autosave trên máy chủ,
    // bên nào có seq lớn hơn thì thắng ở những câu bị trùng.
    let localAnswers: Record<string, AnswerValue> = {};
    let localSeq = 0;
    try {
      const raw = window.sessionStorage.getItem(localAnswersKey(restored.sessionId));
      if (raw) localAnswers = JSON.parse(raw) as Record<string, AnswerValue>;
      localSeq = Number(window.sessionStorage.getItem(seqKey(restored.sessionId)) ?? 0) || 0;
    } catch {
      /* bỏ qua khi dữ liệu hỏng */
    }
    if (Object.keys(localAnswers).length > 0) setAnswers(localAnswers);

    void (async () => {
      try {
        const server = await runLoadProgress({
          data: { sessionId: restored.sessionId, submitToken: restored.submitToken },
        });
        const merged = mergeAnswers<AnswerValue>(
          localAnswers,
          server.answers as Record<string, AnswerValue>,
          localSeq,
          server.seq,
        );
        setAnswers(merged.answers);
        setServerSeq(merged.seq);
        autosaveAckRef.current = {
          answers: (server.answers as Record<string, AnswerValue>) ?? {},
          seq: server.seq,
        };
      } catch {
        /* mất mạng: vẫn thi tiếp bằng bản lưu trên máy */
      }
    })();
  }, [navigate, runLoadProgress]);

  // Lưu đáp án xuống sessionStorage mỗi khi thay đổi (chống mất bài khi F5).
  useEffect(() => {
    if (!session || result) return;
    try {
      window.sessionStorage.setItem(localAnswersKey(session.sessionId), JSON.stringify(answers));
    } catch {
      /* bỏ qua khi trình duyệt chặn lưu trữ */
    }
  }, [answers, session, result]);

  // Autosave đáp án lên máy chủ (delta, nhịp 12s, debounce 2s, tối đa 1 request/5s).
  const {
    status: saveStatus,
    savedAt: lastSavedAt,
    markAcked,
  } = useExamAutosave({
    sessionId: session?.sessionId ?? null,
    submitToken: session?.submitToken ?? null,
    answers,
    enabled: Boolean(session) && !result,
    initialSeq: serverSeq,
  });

  // Sau khi khôi phục xong, báo cho autosave biết máy chủ đã có sẵn những đáp án nào.
  useEffect(() => {
    const ack = autosaveAckRef.current;
    if (!ack) return;
    autosaveAckRef.current = null;
    markAcked(ack.answers, ack.seq);
  }, [markAcked, serverSeq]);

  const finish = useCallback(
    async (opts?: { disqualified?: boolean; reason?: string }) => {
      if (!session || submittedRef.current) return;
      submittedRef.current = true;
      setSending(true);
      try {
        const res = await runSubmit({
          data: {
            sessionId: session.sessionId,
            // Mã nộp bài dùng một lần do máy chủ cấp khi mở phiên thi.
            submitToken: session.submitToken,
            answers,
            disqualified: opts?.disqualified,
            disqualifyReason: opts?.reason,
          },
        });
        sessionStorage.removeItem("exam:" + session.sessionId);
        sessionStorage.removeItem("exam:current");
        sessionStorage.removeItem(localAnswersKey(session.sessionId));
        sessionStorage.removeItem(seqKey(session.sessionId));
        setResult(res);
        window.scrollTo({ top: 0 });
      } catch (error) {
        submittedRef.current = false;
        toast.error(error instanceof Error ? error.message : "Nộp bài thất bại, vui lòng thử lại.");
      } finally {
        setSending(false);
      }
    },
    [answers, runSubmit, session],
  );

  // Đồng hồ đếm ngược theo thời gian máy chủ (bù chênh lệch giờ máy người dùng)
  useEffect(() => {
    if (!session || result) return;
    const end = new Date(session.expiresAt).getTime();
    const offset = new Date(session.serverNow).getTime() - Date.now();
    const tick = () => {
      const left = Math.max(0, Math.round((end - (Date.now() + offset)) / 1000));
      setRemaining(left);
      if (left === 0 && !timeUpRef.current && !submittedRef.current) {
        // Chống gọi lặp: mỗi phiên chỉ tự động nộp một lần duy nhất.
        timeUpRef.current = true;
        setTimeUp(true);
        toast.warning("Hết giờ! Hệ thống tự động nộp bài.");
        void finish();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [session, result, finish]);

  // Chống gian lận: rời khỏi màn hình thi
  useEffect(() => {
    if (!session || result) return;
    const onLeave = (reason: string) => {
      if (submittedRef.current) return;
      setViolations((v) => {
        const next = v + 1;
        if (next >= MAX_VIOLATIONS) {
          toast.error("Bạn đã rời màn hình thi quá số lần cho phép. Bài thi bị huỷ.");
          void finish({ disqualified: true, reason: `${reason} (${next} lần)` });
        } else {
          toast.warning(`Cảnh báo ${next}/${MAX_VIOLATIONS}: không rời khỏi màn hình thi.`);
        }
        return next;
      });
    };
    const onHidden = () => {
      if (document.visibilityState !== "hidden") return;
      onLeave("Rời màn hình thi");
    };
    const onBlur = () => {
      if (document.visibilityState === "hidden") return; // đã tính ở trên
      onLeave("Chuyển sang cửa sổ khác");
    };
    const block = (e: Event) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        ["c", "v", "x", "p", "s", "u"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("blur", onBlur);
    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("paste", block);
    document.addEventListener("keydown", blockKeys);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("paste", block);
      document.removeEventListener("keydown", blockKeys);
    };
  }, [session, result, finish]);

  useEffect(() => {
    if (!session || result) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [session, result]);

  const answeredCount = useMemo(
    () =>
      session
        ? session.questions.filter((q, i) => isAnswered(q.kind, answers[String(i)])).length
        : 0,
    [answers, session],
  );

  const fiftyLeft = 2 - Object.keys(fifty).length;
  const useFifty = useCallback(async () => {
    if (!session) return;
    setFiftyBusy(true);
    try {
      const res = await runFifty({
        data: { sessionId: session.sessionId, submitToken: session.submitToken, index: current },
      });
      setFifty((f) => ({ ...f, [String(current)]: res.removed }));
      toast.success("Đã loại 2 phương án sai.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không dùng được trợ giúp.");
    } finally {
      setFiftyBusy(false);
    }
  }, [current, runFifty, session]);

  const instant = Boolean(session?.settings?.instantFeedback);
  const locked = (idx: number) => instant && feedback[String(idx)] !== undefined;

  /** Ghi nhận đáp án; ở chế độ tức thì sẽ chốt luôn và chấm ngay câu đó. */
  const handleAnswer = useCallback(
    async (idx: number, value: AnswerValue) => {
      if (locked(idx)) return;
      setAnswers((a) => ({ ...a, [String(idx)]: value }));
      if (!instant || !session) return;
      try {
        const res = await runCheck({
          data: {
            sessionId: session.sessionId,
            submitToken: session.submitToken,
            index: idx,
            value,
          },
        });
        setFeedback((f) => ({ ...f, [String(idx)]: res.correct ? "correct" : "wrong" }));
        setCombo((c) => {
          const next = res.correct ? c + 1 : 0;
          if (res.correct && next >= 3) toast.success(`Combo x${next}! Điểm thưởng đang tăng.`);
          return next;
        });
        setTimeout(() => {
          setCurrent((c) => (c < session.questions.length - 1 ? c + 1 : c));
        }, 1100);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không chấm được câu này.");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [instant, feedback, runCheck, session],
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
      sessionStorage.removeItem("exam:" + session.sessionId);
      sessionStorage.removeItem("exam:current");
      sessionStorage.removeItem(localAnswersKey(session.sessionId));
      sessionStorage.removeItem(seqKey(session.sessionId));
    }
    navigate({ to: "/" });
  }, [navigate, runAbandon, session]);

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
        },
      });
      sessionStorage.setItem(examKey(next.sessionId), JSON.stringify(next));
      sessionStorage.setItem(EXAM_CURRENT_KEY, next.sessionId);
      submittedRef.current = false;
      setResult(null);
      setAnswers({});
      setFifty({});
      setFeedback({});
      setCombo(0);
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
  }, [navigate, runStart]);

  if (result) return <ResultView result={result} onRetake={retake} retaking={retaking} />;

  if (!session) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const total = session.questions.length;
  const q = session.questions[current];
  const lowTime = remaining <= 60;
  const progress = Math.round((answeredCount / total) * 100);
  const last = current === total - 1;

  return (
    <div className="no-select min-h-[100dvh] bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-8">
      {sending && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 backdrop-blur-sm">
          <div className="card-elevated flex flex-col items-center gap-2 rounded-2xl px-7 py-5 text-center">
            <Loader2 className="size-5 animate-spin text-accent" />
            <p className="font-heading text-sm font-bold">Đang chấm bài...</p>
          </div>
        </div>
      )}

      {/* Thanh trạng thái gọn: tên cuộc thi, tiến độ, đồng hồ */}
      <header className="surface-hero sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Thoát bài thi"
            className="size-9 shrink-0 rounded-xl text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
            onClick={() => setExitOpen(true)}
          >
            <LogOut className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-sm font-bold">{session.quizTitle}</p>
            <p className="text-[11px] text-primary-foreground/70">
              {answeredCount}/{total} câu
            </p>
          </div>
          {instant && combo >= 2 ? (
            <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 font-heading text-xs font-extrabold text-accent-foreground">
              Combo x{combo}
            </span>
          ) : null}
          <div
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-base font-bold tabular-nums",
              lowTime
                ? "animate-pulse-ring bg-destructive text-destructive-foreground"
                : "bg-primary-foreground/10 text-primary-foreground",
            )}
          >
            <Timer className="size-4" />
            {formatSeconds(remaining)}
          </div>
        </div>
        <div className="mx-auto flex max-w-5xl items-center px-3 pb-1.5 sm:px-4">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
              saveStatus === "offline"
                ? "bg-destructive/20 text-destructive-foreground"
                : "bg-primary-foreground/10 text-primary-foreground/80",
            )}
          >
            {saveStatus === "saving" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : saveStatus === "offline" ? (
              <AlertTriangle className="size-3" />
            ) : (
              <CheckCircle2 className="size-3" />
            )}
            {saveStatus === "saving"
              ? "Đang lưu..."
              : saveStatus === "offline"
                ? "Mất kết nối — bài vẫn được giữ trên máy"
                : lastSavedAt
                  ? "Đã lưu lúc " +
                    lastSavedAt.toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Bài làm được lưu tự động"}
          </span>
        </div>
        <Progress value={progress} className="h-1 rounded-none bg-primary-foreground/15" />
      </header>

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
            Cảnh báo rời màn hình: {violations}/{MAX_VIOLATIONS}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px]">
          <section
            className="card-elevated animate-rise rounded-2xl p-4 sm:p-6"
            key={current}
            data-tour="exam-question"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="type-eyebrow text-accent">
                Câu {current + 1} / {total}
              </p>
              <span className="type-meta rounded-full bg-secondary px-2 py-0.5 font-semibold">
                {KIND_LABEL[q.kind]}
              </span>
              <span className="type-meta rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-accent">
                {q.points} điểm
              </span>
            </div>
            <h1 className="mt-2 text-lg font-bold leading-snug sm:text-xl">{q.question}</h1>

            {questionImageSrc(q.imageUrl) ? (
              <img
                src={questionImageSrc(q.imageUrl)!}
                alt={`Hình minh hoạ câu ${current + 1}`}
                loading="lazy"
                className="mt-4 max-h-56 w-full rounded-xl border border-border object-contain sm:max-h-72"
              />
            ) : null}

            <div key={current} data-tour="exam-options">
              <QuestionInput
                kind={q.kind}
                options={q.options}
                matchLeft={q.matchLeft}
                value={answers[String(current)]}
                removed={fifty[String(current)] ?? []}
                disabled={locked(current)}
                feedback={feedback[String(current)] ?? null}
                onChange={(value) => void handleAnswer(current, value)}
              />
            </div>

            {instant && feedback[String(current)] ? (
              <p
                className={cn(
                  "animate-rise mt-4 rounded-xl px-3 py-2 text-sm font-semibold",
                  feedback[String(current)] === "correct"
                    ? "bg-success/12 text-success"
                    : "bg-destructive/12 text-destructive",
                )}
              >
                {feedback[String(current)] === "correct" ? "Chính xác!" : "Chưa đúng."}
              </p>
            ) : null}

            {/* Vật phẩm trợ giúp */}
            {session.settings.allowFiftyFifty || session.settings.allowSkip ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {session.settings.allowFiftyFifty ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={
                      fiftyBusy ||
                      Boolean(fifty[String(current)]) ||
                      fiftyLeft <= 0 ||
                      (q.kind !== "single" && q.kind !== "true_false")
                    }
                    onClick={() => void useFifty()}
                  >
                    <Wand2 className="size-4" />
                    50:50 ({fiftyLeft})
                  </Button>
                ) : null}
                {session.settings.allowSkip ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    disabled={last}
                    onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))}
                  >
                    Bỏ qua câu này
                    <ArrowRight className="size-4" />
                  </Button>
                ) : null}
              </div>
            ) : null}

            {/* Điều hướng cho desktop — mobile dùng thanh cố định dưới màn hình */}
            <div className="mt-6 hidden items-center justify-between gap-3 lg:flex">
              <Button
                variant="outline"
                disabled={current === 0}
                onClick={() => setCurrent((c) => c - 1)}
              >
                <ArrowLeft className="size-4" />
                Câu trước
              </Button>
              {last ? (
                <Button onClick={() => setConfirmOpen(true)}>
                  <Send className="size-4" />
                  Nộp bài
                </Button>
              ) : (
                <Button onClick={() => setCurrent((c) => c + 1)}>
                  Câu tiếp
                  <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </section>

          {/* Lưới câu hỏi: cột phải trên desktop, bảng bật/tắt trên mobile */}
          <aside
            className={cn(
              "card-elevated h-fit rounded-2xl p-3 lg:sticky lg:top-20 lg:block",
              navOpen ? "block" : "hidden",
            )}
            data-tour="exam-nav"
          >
            <p className="type-meta mb-2 font-semibold text-foreground">Danh sách câu hỏi</p>
            <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-5">
              {session.questions.map((item, i) => {
                const done = isAnswered(item.kind, answers[String(i)]);
                const fb = feedback[String(i)];

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setCurrent(i);
                      setNavOpen(false);
                    }}
                    className={cn(
                      "aspect-square rounded-lg border text-xs font-semibold transition-all hover:scale-105",
                      i === current
                        ? "border-accent bg-accent text-accent-foreground"
                        : fb === "correct"
                          ? "border-success/40 bg-success/20 text-success"
                          : fb === "wrong"
                            ? "border-destructive/40 bg-destructive/15 text-destructive"
                            : done
                              ? "border-success/40 bg-success/15 text-success"
                              : "border-border bg-card text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <Button
              className="mt-3 hidden w-full lg:flex"
              variant="secondary"
              onClick={() => setConfirmOpen(true)}
            >
              <Send className="size-4" />
              Nộp bài
            </Button>
          </aside>
        </div>
      </main>

      {/* Thanh hành động cố định trên mobile: ưu tiên "Câu tiếp"/"Nộp bài" */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-[calc(0.75rem+env(safe-area-inset-left))] pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-11 shrink-0 rounded-xl"
            aria-label="Câu trước"
            disabled={current === 0}
            onClick={() => setCurrent((c) => c - 1)}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="h-11 shrink-0 rounded-xl px-3 font-mono text-xs"
            onClick={() => setNavOpen((v) => !v)}
            aria-label="Danh sách câu hỏi"
          >
            {current + 1}/{total}
          </Button>
          {last ? (
            <Button className="h-11 flex-1 rounded-xl" onClick={() => setConfirmOpen(true)}>
              <Send className="size-4" />
              Nộp bài
            </Button>
          ) : (
            <Button className="h-11 flex-1 rounded-xl" onClick={() => setCurrent((c) => c + 1)}>
              Câu tiếp
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận nộp bài?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn đã trả lời {answeredCount}/{total} câu. Sau khi nộp sẽ không thể chỉnh sửa, nhưng
              bạn luôn có thể thi lại để cải thiện điểm số.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tiếp tục làm bài</AlertDialogCancel>
            <AlertDialogAction onClick={() => void finish()} disabled={sending}>
              {sending && <Loader2 className="size-4 animate-spin" />}
              Nộp bài
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Thoát bài thi?</AlertDialogTitle>
            <AlertDialogDescription>
              Lượt thi này sẽ bị huỷ và không được tính điểm. Bạn có thể bắt đầu lượt thi mới bất cứ
              lúc nào.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ở lại làm bài</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doExit()}>Thoát</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Thứ hạng cập nhật trực tiếp khi có thí sinh khác nộp bài. */
function LiveRank({ result }: { result: SubmitExamResult }) {
  const queryKey = ["live-rank", result.quizId, result.score, result.timeSeconds];
  const { live } = useRealtimeResults({ queryKey, quizId: result.quizId });

  const rankQuery = useQuery({
    queryKey,
    staleTime: 10_000,
    queryFn: async () => {
      const base = supabase
        .from("results")
        .select("id", { count: "exact", head: true })
        .eq("disqualified", false);
      const [total, better] = await Promise.all([
        base.eq("quiz_id", result.quizId),
        supabase
          .from("results")
          .select("id", { count: "exact", head: true })
          .eq("disqualified", false)
          .eq("quiz_id", result.quizId)
          .or(
            `score.gt.${result.score},and(score.eq.${result.score},time_seconds.lt.${result.timeSeconds})`,
          ),
      ]);
      return { total: total.count ?? 0, rank: (better.count ?? 0) + 1 };
    },
  });

  return (
    <p
      className="type-meta inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1 text-primary-foreground/85"
      aria-live="polite"
    >
      {live ? <Radio className="size-3.5 text-success" /> : null}
      {rankQuery.data
        ? `Hạng ${rankQuery.data.rank}/${rankQuery.data.total}`
        : "Đang tính thứ hạng..."}
    </p>
  );
}

function ResultView({
  result,
  onRetake,
  retaking,
}: {
  result: SubmitExamResult;
  onRetake: () => void;
  retaking?: boolean;
}) {
  const percent = Math.round((result.score / Math.max(1, result.total)) * 100);
  const wrong = result.review.filter((r) => !r.correct);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? result.review : wrong;

  const celebrate = !result.disqualified && result.passed;

  return (
    <div className="min-h-[100dvh] bg-background pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      {celebrate ? <Celebration /> : null}
      {/* Tóm tắt kết quả gọn trong một màn hình */}
      <div className={cn("surface-hero grid-pattern", celebrate && "animate-result-glow")}>
        <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
          <p className="type-meta text-primary-foreground/70">{result.quizTitle}</p>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="min-w-0">
              <h1 className="type-h2 text-primary-foreground">
                {result.disqualified
                  ? "Bài thi bị huỷ"
                  : result.passed
                    ? "Chúc mừng, bạn đã ĐẠT!"
                    : "Chưa đạt yêu cầu"}
              </h1>
              <p
                className={cn(
                  "mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  result.disqualified
                    ? "bg-destructive/25 text-destructive-foreground"
                    : result.passed
                      ? "bg-success/25 text-primary-foreground"
                      : "bg-warning/25 text-primary-foreground",
                )}
              >
                {result.disqualified || !result.passed ? (
                  <XCircle className="size-3.5" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                {result.disqualified
                  ? "Không tính vào bảng xếp hạng"
                  : `Đạt khi ≥ ${result.passPercent}% · thời gian ${formatSeconds(result.timeSeconds)}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="type-meta inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1 text-primary-foreground/85">
                  <Sparkles className="size-3.5 text-gold" />
                  {result.points} điểm thưởng / {result.maxPoints}
                </span>
                <span className="type-meta inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1 text-primary-foreground/85">
                  <Flame className="size-3.5 text-warning" />
                  Chuỗi đúng dài nhất: {result.bestStreak}
                </span>
              </div>
              {result.improved ? (
                <p className="type-meta mt-2 inline-flex items-center gap-1.5 text-primary-foreground/85">
                  <TrendingUp className="size-3.5 text-success" />
                  Vượt kỷ lục cũ ({result.previousBestPercent}%) — tiếp tục phát huy!
                </p>
              ) : null}
            </div>
            <div className="shrink-0 rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 px-5 py-3 text-center">
              <p className="font-mono text-3xl font-extrabold leading-none sm:text-4xl">
                {result.score}
                <span className="text-lg text-primary-foreground/60">/{result.total}</span>
              </p>
              <p className="type-meta mt-1 text-primary-foreground/70">{percent}%</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button
              className="h-10 flex-1 rounded-xl sm:flex-none"
              onClick={onRetake}
              disabled={retaking}
            >
              {retaking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {result.passed ? "Thi lại để lên điểm" : "Thi lại ngay"}
            </Button>
            <Button asChild variant="secondary" className="h-10 flex-1 rounded-xl sm:flex-none">
              <a href="/bang-xep-hang">Bảng xếp hạng</a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-10 rounded-xl border-primary-foreground/30 bg-transparent"
            >
              <a href="/lich-su">Lịch sử làm bài</a>
            </Button>
            {!result.disqualified && result.passed ? <LiveRank result={result} /> : null}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="type-h3">Xem lại đáp án</h2>
            <p className="type-meta">
              {wrong.length > 0
                ? `${wrong.length} câu cần ôn lại`
                : "Bạn trả lời đúng tất cả các câu."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 rounded-full"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Chỉ câu sai" : "Xem tất cả"}
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {visible.map((item, idx) => {
            const number = result.review.indexOf(item) + 1;
            return (
              <article key={idx} className="card-elevated animate-rise rounded-2xl p-4">
                <div className="flex items-start gap-2.5">
                  {item.correct ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <p className="min-w-0 text-sm font-semibold leading-relaxed">
                    Câu {number}. {item.question}
                  </p>
                  <span className="type-meta shrink-0 rounded-full bg-secondary px-2 py-0.5">
                    {KIND_LABEL[item.kind]}
                  </span>
                </div>
                {questionImageSrc(item.imageUrl) ? (
                  <img
                    src={questionImageSrc(item.imageUrl)!}
                    alt={`Hình minh hoạ câu ${number}`}
                    loading="lazy"
                    className="mt-3 max-h-48 w-full rounded-xl border border-border object-contain"
                  />
                ) : null}
                <div className="mt-3 space-y-1.5 text-sm">
                  <p
                    className={cn(
                      "rounded-lg border px-3 py-1.5",
                      item.correct
                        ? "border-success/50 bg-success/10 text-success"
                        : "border-destructive/50 bg-destructive/10 text-destructive",
                    )}
                  >
                    <span className="font-semibold">Bạn trả lời: </span>
                    {item.answered ? item.chosenText : "(chưa trả lời)"}
                  </p>
                  {!item.correct ? (
                    <p className="rounded-lg border border-success/50 bg-success/10 px-3 py-1.5 text-success">
                      <span className="font-semibold">Đáp án đúng: </span>
                      {item.correctText}
                    </p>
                  ) : null}
                  {item.explanation ? (
                    <p className="rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-muted-foreground">
                      <span className="font-semibold text-foreground">Giải thích: </span>
                      {item.explanation}
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
          {visible.length === 0 ? (
            <p className="type-muted rounded-2xl border border-dashed border-border p-6 text-center">
              Không có câu sai nào. Bấm “Xem tất cả” để ôn lại toàn bộ đề.
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
