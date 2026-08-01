import { ErrorState } from "@/components/ui-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Castle, CloudOff, Heart, Loader2, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { QuestionInput } from "@/components/exam/QuestionInput";
import { RichText } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHero, SectionHeading } from "@/components/ui-kit";
import { readExamEntry, type ExamEntry } from "@/lib/examSession";
import type { AnswerValue } from "@/lib/questionKinds";
import { bankIsStale, type QuestionBank } from "@/lib/tower/bank";
import { QUESTIONS_PER_STAGE, START_HP, STAGES_PER_RUN, stageName } from "@/lib/tower/config";
import { createRun, gradeStage, takeBoon, type StageOutcome, type TowerRun } from "@/lib/tower/engine";
import {
  readCachedBank,
  readCachedState,
  readPendingSync,
  writeCachedBank,
  writeCachedState,
  writePendingSync,
} from "@/lib/tower/idb";
import { applyResults, dueCardIds, emptyState, mergeStates, normalizeState, type TowerState } from "@/lib/tower/state";
import { getTowerBankFn, openTowerFn, syncTowerFn } from "@/lib/tower.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dau-truong_/leo-thap")({
  component: TowerPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <ErrorState error={error} />
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Tháp Không Lưu (TWR ATC) — Hội thi trắc nghiệm VATM" },
      {
        name: "description",
        content:
          "Ôn nghiệp vụ điều hành bay theo lịch lặp lại ngắt quãng: mỗi ca trực 5 tầng, từ sân đỗ lên đường dài.",
      },
      { property: "og:title", content: "Tháp Không Lưu (TWR ATC) — Hội thi trắc nghiệm VATM" },
      {
        property: "og:description",
        content: "Ôn đúng câu nghiệp vụ bạn sắp quên, theo lịch lặp lại ngắt quãng của riêng bạn.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const STAGE_SECONDS = 20 * QUESTIONS_PER_STAGE;

function HpBarLite({ hp }: { hp: number }) {
  const pct = Math.max(0, Math.min(100, (hp / START_HP) * 100));
  return (
    <div className="flex items-center gap-2">
      <Heart className="size-4 text-destructive" />
      <div className="h-2.5 w-40 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-destructive transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="type-meta tabular-nums">{hp}</span>
    </div>
  );
}

/**
 * Kiến trúc nhẹ máy chủ: trang này tự chấm, tự lên lịch ôn trong trình duyệt.
 * Máy chủ chỉ tham gia 2 lần: mở phiên (tải gói đề + tiến trình) và đồng bộ khi kết thúc.
 * Kỳ thi chính thức và Đấu trường KHÔNG dùng luồng này — hai nơi đó vẫn chấm ở máy chủ.
 */
function TowerPage() {
  const openTower = useServerFn(openTowerFn);
  const fetchBank = useServerFn(getTowerBankFn);
  const sync = useServerFn(syncTowerFn);

  const [entry, setEntry] = useState<ExamEntry | null>(null);
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [state, setState] = useState<TowerState>(emptyState());
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(false);
  const [dueCount, setDueCount] = useState(0);

  const [run, setRun] = useState<TowerRun | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [outcome, setOutcome] = useState<StageOutcome | null>(null);
  const [pickedBoon, setPickedBoon] = useState<string | undefined>(undefined);
  const [summary, setSummary] = useState<{ stagesCleared: number; correct: number; answered: number } | null>(null);

  const clockRef = useRef<HTMLSpanElement | null>(null);
  const deadlineRef = useRef<number>(0);
  const onTimeUpRef = useRef<() => void>(() => undefined);
  const stateRef = useRef<TowerState>(state);
  stateRef.current = state;

  useEffect(() => {
    setEntry(readExamEntry(window.sessionStorage));
  }, []);

  // Đồng hồ: một vòng rAF, ghi thẳng vào DOM (không setState mỗi khung hình).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const left = Math.max(0, deadlineRef.current - Date.now());
      if (clockRef.current) {
        const s = Math.ceil(left / 1000);
        clockRef.current.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
      }
      if (deadlineRef.current && left <= 0) {
        deadlineRef.current = 0;
        onTimeUpRef.current();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const credentials = useCallback(
    () =>
      entry
        ? {
            name: entry.name,
            credential: entry.credential,
            ...(entry.extraCredential ? { extraCredential: entry.extraCredential } : {}),
          }
        : null,
    [entry],
  );

  /** Một lượt đi về: tiến trình + phiên bản gói đề; chỉ tải gói khi đã cũ. */
  useEffect(() => {
    const creds = credentials();
    if (!creds) return;
    let alive = true;

    void (async () => {
      setLoading(true);
      const [cachedBank, cachedState, wasPending] = await Promise.all([
        readCachedBank(),
        readCachedState(),
        readPendingSync(),
      ]);
      if (!alive) return;
      if (cachedState) setState(normalizeState(cachedState));
      if (cachedBank) setBank(cachedBank);
      setPending(Boolean(wasPending));

      try {
        const opened = await openTower({ data: creds });
        if (!alive) return;
        const server = normalizeState(opened.state);
        const merged = cachedState ? mergeStates(server, normalizeState(cachedState)) : server;
        setState(merged);
        void writeCachedState(merged);

        if (bankIsStale(cachedBank, opened.bankVersion)) {
          const fresh = await fetchBank({ data: creds });
          if (!alive) return;
          setBank(fresh);
          void writeCachedBank(fresh);
        }
        setOffline(false);
      } catch (e) {
        // Mất mạng vẫn ôn được nếu đã có gói trong máy.
        if (!alive) return;
        setOffline(true);
        if (!cachedBank) toast.error(e instanceof Error ? e.message : "Không mở được Tháp Không Lưu.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [credentials, openTower, fetchBank]);

  useEffect(() => {
    setDueCount(dueCardIds(state).length);
  }, [state]);

  /** Gửi tiến trình lên máy chủ — gộp một lần, chỉ khi kết thúc phiên. */
  const pushSync = useCallback(
    async (next: TowerState) => {
      const creds = credentials();
      if (!creds) return;
      try {
        await sync({ data: { ...creds, state: next, bestStage: run?.stage ?? 0, runs: 1 } });
        setPending(false);
        void writePendingSync(false);
      } catch {
        setPending(true);
        void writePendingSync(true);
      }
    },
    [credentials, sync, run],
  );

  const finishRun = useCallback(
    (finished: TowerRun) => {
      setSummary({
        stagesCleared: Math.min(finished.stage, STAGES_PER_RUN),
        correct: finished.correct,
        answered: finished.answered,
      });
      void pushSync(stateRef.current);
    },
    [pushSync],
  );

  /** Chốt chặng: chấm ngay tại máy, 0 ms chờ mạng. */
  const closeStage = useCallback(
    (current: Record<string, AnswerValue>) => {
      if (!run || outcome) return;
      deadlineRef.current = 0;
      const graded = gradeStage(run, current);
      const nextState = applyResults(stateRef.current, graded.outcome.results);
      setState(nextState);
      void writeCachedState(nextState);
      setOutcome(graded.outcome);
      setRun(graded.run);
      setPickedBoon(undefined);
      if (graded.run.finished) finishRun(graded.run);
    },
    [run, outcome, finishRun],
  );

  useEffect(() => {
    onTimeUpRef.current = () => closeStage(answers);
  }, [closeStage, answers]);

  function begin() {
    if (!bank) return;
    try {
      const fresh = createRun(bank, state, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      setRun(fresh);
      setIdx(0);
      setAnswers({});
      setOutcome(null);
      setSummary(null);
      setPickedBoon(undefined);
      deadlineRef.current = Date.now() + STAGE_SECONDS * 1000;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chưa có câu hỏi nghiệp vụ để ôn tập.");
    }
  }

  function nextStage() {
    if (!run) return;
    setRun(takeBoon(run, pickedBoon));
    setIdx(run.stage * QUESTIONS_PER_STAGE);
    setOutcome(null);
    deadlineRef.current = Date.now() + STAGE_SECONDS * 1000;
  }

  const stage = outcome ? Math.max(0, (run?.stage ?? 1) - 1) : (run?.stage ?? 0);
  const question = run?.questions[idx];
  const inStagePos = idx - stage * QUESTIONS_PER_STAGE + 1;
  const totalStages = run ? Math.ceil(run.questions.length / QUESTIONS_PER_STAGE) : STAGES_PER_RUN;

  return (
    <PageContainer>
      <PageHero
        icon={Castle}
        title="Tháp Không Lưu (TWR ATC)"
        description="Ôn nghiệp vụ điều hành bay — mỗi ca trực 5 tầng, mỗi tầng 5 câu."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/dau-truong">
            <ArrowLeft className="mr-1.5 size-4" /> Về sảnh Đấu trường
          </Link>
        </Button>
        {offline && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600">
            <WifiOff className="size-3.5" /> Đang ôn ngoại tuyến
          </span>
        )}
        {pending && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            <CloudOff className="size-3.5" /> Tiến trình sẽ gửi lại khi có mạng
          </span>
        )}
      </div>

      {!entry && (
        <section className="rounded-2xl border bg-card/70 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Hãy vào một phòng thi một lần để hệ thống nhận ra bạn, sau đó quay lại đây để ôn tập.
          </p>
          <Button asChild className="mt-4">
            <Link to="/">Chọn cuộc thi</Link>
          </Button>
        </section>
      )}

      {entry && !run && (
        <section className="rounded-2xl border bg-card/70 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Xin chào <strong>{entry.name}</strong>. Mỗi ca trực khoảng 12–15 phút, không tính vào kết quả kỳ thi.
          </p>
          <p className="type-meta mt-1">
            {loading
              ? "Đang chuẩn bị gói nghiệp vụ cho bạn…"
              : `${dueCount} thẻ đang đến hạn ôn · ${bank?.questions.length ?? 0} câu trong gói`}
          </p>
          <Button className="mt-4" disabled={loading || !bank} onClick={begin}>
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Castle className="mr-2 size-4" />}
            Vào ca trực
          </Button>
        </section>
      )}

      {run && summary && (
        <section className="space-y-4 rounded-2xl border bg-card/70 p-6">
          <SectionHeading title="Hôm nay bạn đã học được gì" />
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Tầng đã qua", value: summary.stagesCleared },
              { label: "Câu đúng", value: summary.correct },
              { label: "Câu đã làm", value: summary.answered },
              { label: "Thẻ còn đến hạn", value: dueCount },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border bg-background/60 p-3 text-center">
                <div className="text-2xl font-bold tabular-nums">{s.value}</div>
                <div className="type-meta">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={begin}>Vào ca trực mới</Button>
            <Button asChild variant="outline">
              <Link to="/dau-truong">Nghỉ một chút</Link>
            </Button>
          </div>
        </section>
      )}

      {run && outcome && (
        <section className="space-y-4 rounded-2xl border bg-card/70 p-6">
          <SectionHeading title={`Góc rút kinh nghiệm — ${stageName(stage)}`} />
          <ul className="space-y-2">
            {outcome.results.map((r, i) => (
              <li
                key={r.questionId}
                className={cn(
                  "rounded-xl border p-3 text-sm",
                  r.correct ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5",
                )}
              >
                <div className="font-medium">
                  Câu {i + 1}: {r.correct ? "Chính xác" : "Cần ôn lại"}
                </div>
                {!r.correct && <div className="type-meta mt-1">Đáp án đúng: {r.correctText}</div>}
                {r.explanation && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    <RichText>{r.explanation}</RichText>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {!summary && run.offered.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Chọn một trợ giúp cho tầng sau</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {run.offered.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setPickedBoon(b.id)}
                    className={cn(
                      "rounded-xl border p-3 text-left text-sm transition hover:border-primary",
                      pickedBoon === b.id && "border-primary bg-primary/5",
                    )}
                  >
                    <div className="font-semibold">{b.name}</div>
                    <div className="type-meta">{b.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!summary && <Button onClick={nextStage}>Lên {stageName(run.stage)}</Button>}
          {summary && outcome.softStop && (
            <p className="type-meta">
              Ca trực khép lại sớm ở đây để bạn ôn kỹ phần còn vướng — không sao cả, lần sau nhẹ hơn.
            </p>
          )}
        </section>
      )}

      {run && !summary && !outcome && question && (
        <section className="space-y-4 rounded-2xl border bg-card/70 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {stageName(stage)} ({stage + 1}/{totalStages}) · câu {inStagePos}/{QUESTIONS_PER_STAGE}
            </span>
            <HpBarLite hp={run.hp} />
            <span ref={clockRef} className="ml-auto font-mono text-sm tabular-nums" />
          </div>

          <div className="text-base font-medium">
            <RichText>{question.question}</RichText>
          </div>

          <QuestionInput
            kind={question.kind}
            options={question.options}
            optionImages={question.optionImages}
            matchLeft={question.pairs.map((p) => p.left)}
            value={answers[String(idx)]}
            onChange={(v) => setAnswers((prev) => ({ ...prev, [String(idx)]: v }))}
          />

          <div className="flex justify-end gap-2">
            {inStagePos < QUESTIONS_PER_STAGE ? (
              <Button onClick={() => setIdx((i) => i + 1)}>Câu tiếp theo</Button>
            ) : (
              <Button onClick={() => closeStage(answers)}>Chốt {stageName(stage)}</Button>
            )}
          </div>
        </section>
      )}
    </PageContainer>
  );
}
