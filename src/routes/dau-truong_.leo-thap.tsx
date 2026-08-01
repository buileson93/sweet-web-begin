import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Castle, Heart, Loader2, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";

import { QuestionInput } from "@/components/exam/QuestionInput";
import { RichText } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHero, SectionHeading } from "@/components/ui-kit";
import { readExamEntry, type ExamEntry } from "@/lib/examSession";
import type { AnswerValue } from "@/lib/questionKinds";
import { QUESTIONS_PER_STAGE, START_HP, type Boon } from "@/lib/tower/config";
import { finishTower, startTower, submitTowerStageFn } from "@/lib/tower.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dau-truong_/leo-thap")({
  component: TowerPage,
  head: () => ({
    meta: [
      { title: "Leo Tháp Tri Thức — Hội thi trắc nghiệm VATM" },
      {
        name: "description",
        content:
          "Chế độ ôn tập cá nhân theo lịch lặp lại ngắt quãng: mỗi phiên 5 chặng, ôn đúng câu bạn sắp quên.",
      },
      { property: "og:title", content: "Leo Tháp Tri Thức — Hội thi trắc nghiệm VATM" },
      {
        property: "og:description",
        content: "Ôn đúng câu bạn sắp quên, theo lịch lặp lại ngắt quãng của riêng bạn.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Run = Awaited<ReturnType<typeof startTower>>;
type StageResult = Awaited<ReturnType<typeof submitTowerStageFn>>;
type Summary = Awaited<ReturnType<typeof finishTower>>;

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

function TowerPage() {
  const start = useServerFn(startTower);
  const submitStage = useServerFn(submitTowerStageFn);
  const finish = useServerFn(finishTower);

  const [entry, setEntry] = useState<ExamEntry | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [stage, setStage] = useState(0);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [hp, setHp] = useState(START_HP);
  const [busy, setBusy] = useState(false);
  const [stageResult, setStageResult] = useState<StageResult | null>(null);
  const [boons, setBoons] = useState<Boon[]>([]);
  const [pickedBoon, setPickedBoon] = useState<string | undefined>(undefined);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Một vòng rAF duy nhất cho đồng hồ — ghi thẳng vào DOM, không setState mỗi khung.
  const clockRef = useRef<HTMLSpanElement | null>(null);
  const deadlineRef = useRef<number>(0);
  const onTimeUpRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    setEntry(readExamEntry(window.sessionStorage));
  }, []);

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

  const sendStage = useCallback(
    async (currentStage: number, current: Record<string, AnswerValue>) => {
      if (!run) return;
      setBusy(true);
      deadlineRef.current = 0;
      try {
        const res = await submitStage({
          data: {
            runId: run.runId,
            token: run.token,
            stageIndex: currentStage,
            answers: current,
            ...(pickedBoon ? { boonId: pickedBoon } : {}),
          },
        });
        setStageResult(res);
        setHp(res.hp);
        setBoons(res.boons as Boon[]);
        setPickedBoon(undefined);
        if (res.finished) {
          const sum = await finish({ data: { runId: run.runId, token: run.token } });
          setSummary(sum);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Không chấm được chặng này.");
      } finally {
        setBusy(false);
      }
    },
    [run, submitStage, finish, pickedBoon],
  );

  useEffect(() => {
    onTimeUpRef.current = () => void sendStage(stage, answers);
  }, [sendStage, stage, answers]);

  async function begin() {
    if (!entry) return;
    setBusy(true);
    try {
      const res = await start({
        data: {
          name: entry.name,
          credential: entry.credential,
          ...(entry.extraCredential ? { extraCredential: entry.extraCredential } : {}),
        },
      });
      setRun(res);
      setBoons(res.boons as Boon[]);
      setHp(res.hp);
      setStage(0);
      setIdx(0);
      setAnswers({});
      setSummary(null);
      setStageResult(null);
      deadlineRef.current = Date.now() + STAGE_SECONDS * 1000;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không mở được phiên leo tháp.");
    } finally {
      setBusy(false);
    }
  }

  function nextStage() {
    if (!stageResult) return;
    setStage(stageResult.nextStage);
    setIdx(stageResult.nextStage * QUESTIONS_PER_STAGE);
    setStageResult(null);
    deadlineRef.current = Date.now() + STAGE_SECONDS * 1000;
  }

  const question = run?.questions[idx];
  const stageStart = stage * QUESTIONS_PER_STAGE;
  const inStagePos = idx - stageStart + 1;

  return (
    <PageContainer>
      <PageHero
        icon={<Castle className="size-6" />}
        title="Leo Tháp Tri Thức"
        subtitle="Ôn đúng câu bạn sắp quên — mỗi phiên 5 chặng, mỗi chặng 5 câu."
      />

      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/dau-truong">
            <ArrowLeft className="mr-1.5 size-4" /> Về sảnh Đấu trường
          </Link>
        </Button>
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
            Xin chào <strong>{entry.name}</strong>. Mỗi phiên khoảng 12–15 phút, không tính vào
            kết quả kỳ thi.
          </p>
          <Button className="mt-4" disabled={busy} onClick={() => void begin()}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Castle className="mr-2 size-4" />}
            Bắt đầu leo tháp
          </Button>
        </section>
      )}

      {run && summary && (
        <section className="space-y-4 rounded-2xl border bg-card/70 p-6">
          <SectionHeading title="Hôm nay bạn đã học được gì" icon={<Trophy className="size-5" />} />
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Chặng đã qua", value: summary.stagesCleared },
              { label: "Câu đúng", value: summary.correct },
              { label: "Câu đã làm", value: summary.answered },
              { label: "Thẻ còn đến hạn", value: summary.remainingDue },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border bg-background/60 p-3 text-center">
                <div className="text-2xl font-bold tabular-nums">{s.value}</div>
                <div className="type-meta">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void begin()} disabled={busy}>
              Leo phiên mới
            </Button>
            <Button asChild variant="outline">
              <Link to="/dau-truong">Nghỉ một chút</Link>
            </Button>
          </div>
        </section>
      )}

      {run && !summary && stageResult && (
        <section className="space-y-4 rounded-2xl border bg-card/70 p-6">
          <SectionHeading
            title={`Góc sửa lỗi — chặng ${stage + 1}`}
            icon={<Sparkles className="size-5" />}
          />
          <ul className="space-y-2">
            {stageResult.results.map((r, i) => (
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
                    <RichText text={r.explanation} />
                  </div>
                )}
              </li>
            ))}
          </ul>

          {boons.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Chọn một trợ học cho chặng sau</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {boons.map((b) => (
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

          <Button onClick={nextStage}>Lên chặng {stageResult.nextStage + 1}</Button>
        </section>
      )}

      {run && !summary && !stageResult && question && (
        <section className="space-y-4 rounded-2xl border bg-card/70 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Chặng {stage + 1}/{run.stages} · câu {inStagePos}/{run.perStage}
            </span>
            <HpBarLite hp={hp} />
            <span ref={clockRef} className="ml-auto font-mono text-sm tabular-nums" />
          </div>

          <div className="text-base font-medium">
            <RichText text={question.question} />
          </div>

          <QuestionInput
            kind={question.kind}
            options={question.options}
            optionImages={question.optionImages}
            matchLeft={question.matchLeft}
            value={answers[String(idx)]}
            onChange={(v) => setAnswers((prev) => ({ ...prev, [String(idx)]: v }))}
            disabled={busy}
          />

          <div className="flex justify-end gap-2">
            {inStagePos < run.perStage ? (
              <Button onClick={() => setIdx((i) => i + 1)} disabled={busy}>
                Câu tiếp theo
              </Button>
            ) : (
              <Button onClick={() => void sendStage(stage, answers)} disabled={busy}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                Chốt chặng {stage + 1}
              </Button>
            )}
          </div>
        </section>
      )}
    </PageContainer>
  );
}
