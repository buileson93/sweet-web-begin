import { ErrorState } from "@/components/ui-kit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Castle,
  CloudOff,
  Flame,
  Heart,
  Loader2,
  RefreshCw,
  Shield,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import { QuestionInput } from "@/components/exam/QuestionInput";
import { RichText } from "@/components/RichText";
import { Button } from "@/components/ui/button";
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
import { PageContainer, PageHero, SectionHeading } from "@/components/ui-kit";
import { readExamEntry } from "@/lib/examSession";
import { readQuickLogin, saveQuickLogin } from "@/lib/quickLogin";
import { CredentialInput } from "@/components/CredentialInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AnswerValue } from "@/lib/questionKinds";
import { bankIsStale, bankQuizzes, filterBankByQuizzes, type QuestionBank } from "@/lib/tower/bank";
import { QUESTIONS_PER_STAGE, START_HP, STAGES_PER_RUN, stageName } from "@/lib/tower/config";
import {
  createRun,
  gradeStage,
  runBoonTotals,
  stageSeconds,
  takeBoon,
  type StageOutcome,
  type TowerRun,
} from "@/lib/tower/engine";
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

/** Khoá lưu ca trực đang dở để F5 hoặc khoá máy không mất bài. */
const RESUME_KEY = "vatm:tower:resume";

/** Ghi nhớ các bộ đề đã chọn cho ca trực sau. */
const PACKS_KEY = "vatm:tower:packs";

type Resume = {
  run: TowerRun;
  idx: number;
  answers: Record<string, AnswerValue>;
  deadline: number;
};

function readResume(): Resume | null {
  try {
    const raw = window.sessionStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Resume;
    if (!parsed?.run?.questions?.length || parsed.run.finished) return null;
    return parsed;
  } catch {
    return null;
  }
}

function HpBarLite({ hp, shield }: { hp: number; shield: number }) {
  const pct = Math.max(0, Math.min(100, (hp / START_HP) * 100));
  return (
    <div className="flex items-center gap-2">
      <Heart className="size-4 text-destructive" />
      <div className="h-2.5 w-32 overflow-hidden rounded-full bg-muted sm:w-40">
        <div
          className="h-full rounded-full bg-destructive transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="type-meta tabular-nums">{hp}</span>
      {shield > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-600">
          <Shield className="size-3" /> {shield}
        </span>
      ) : null}
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

  /** Danh tính để mở gói ôn: chỉ cần họ tên + 4 số cuối SĐT (hoặc ngày sinh). */
  type Ident = { name: string; credential: string; extraCredential?: string };
  const [entry, setEntry] = useState<Ident | null>(null);
  const [formName, setFormName] = useState("");
  const [formCredential, setFormCredential] = useState("");
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [state, setState] = useState<TowerState>(emptyState());
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(false);
  const [dueCount, setDueCount] = useState(0);
  const [packs, setPacks] = useState<string[]>([]);

  const [run, setRun] = useState<TowerRun | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [outcome, setOutcome] = useState<StageOutcome | null>(null);
  const [pickedBoon, setPickedBoon] = useState<string | undefined>(undefined);
  const [summary, setSummary] = useState<{ stagesCleared: number; correct: number; answered: number } | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [lowTime, setLowTime] = useState(false);

  const clockRef = useRef<HTMLSpanElement | null>(null);
  const deadlineRef = useRef<number>(0);
  const onTimeUpRef = useRef<() => void>(() => undefined);
  const stateRef = useRef<TowerState>(state);
  stateRef.current = state;
  const pendingRef = useRef(false);
  pendingRef.current = pending;

  useEffect(() => {
    const saved = readExamEntry(window.sessionStorage);
    const quick = readQuickLogin();
    const ident: Ident | null = saved
      ? { name: saved.name, credential: saved.credential, ...(saved.extraCredential ? { extraCredential: saved.extraCredential } : {}) }
      : quick
        ? { name: quick.name, credential: quick.credential }
        : null;
    setEntry(ident);
    if (ident) {
      setFormName(ident.name);
      setFormCredential(ident.credential);
    }
    try {
      const raw = window.localStorage.getItem(PACKS_KEY);
      if (raw) setPacks(JSON.parse(raw) as string[]);
    } catch {
      /* không đọc được thì mặc định dùng cả gói */
    }
    const resume = readResume();
    if (resume) {
      setRun(resume.run);
      setIdx(resume.idx);
      setAnswers(resume.answers);
      deadlineRef.current = resume.deadline;
      toast.message("Đã khôi phục ca trực đang dở của bạn.");
    }
  }, []);

  const playing = Boolean(run && !summary && !outcome);

  // Đồng hồ: chỉ chạy vòng rAF khi thật sự đang làm bài, ghi thẳng vào DOM.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let lastLow = false;
    const tick = () => {
      const left = Math.max(0, deadlineRef.current - Date.now());
      if (clockRef.current) {
        const s = Math.ceil(left / 1000);
        clockRef.current.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
      }
      const low = deadlineRef.current > 0 && left <= 30_000;
      if (low !== lastLow) {
        lastLow = low;
        setLowTime(low);
      }
      if (deadlineRef.current && left <= 0) {
        deadlineRef.current = 0;
        onTimeUpRef.current();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Lưu ca trực đang dở sau mỗi thay đổi để F5 không mất bài.
  useEffect(() => {
    if (!run || summary || outcome) {
      window.sessionStorage.removeItem(RESUME_KEY);
      return;
    }
    const payload: Resume = { run, idx, answers, deadline: deadlineRef.current };
    try {
      window.sessionStorage.setItem(RESUME_KEY, JSON.stringify(payload));
    } catch {
      /* bộ nhớ đầy thì bỏ qua, không chặn người dùng làm bài */
    }
  }, [run, idx, answers, summary, outcome]);

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
    async (next: TowerState, bestStage: number) => {
      const creds = credentials();
      if (!creds) return;
      try {
        await sync({ data: { ...creds, state: next, bestStage, runs: 1 } });
        setPending(false);
        void writePendingSync(false);
      } catch {
        setPending(true);
        void writePendingSync(true);
      }
    },
    [credentials, sync],
  );

  // Có mạng trở lại thì tự gửi lại tiến trình còn treo.
  useEffect(() => {
    const retry = () => {
      if (!pendingRef.current) return;
      void pushSync(stateRef.current, 0);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [pushSync]);

  const finishRun = useCallback(
    (finished: TowerRun, done: StageOutcome) => {
      // Tầng vừa chấm chỉ được tính là "đã qua" khi còn máu và không phải dừng sớm.
      const reached = Math.min(finished.stage, STAGES_PER_RUN);
      const cleared = done.softStop || finished.hp <= 0 ? Math.max(0, reached - 1) : reached;
      setSummary({ stagesCleared: cleared, correct: finished.correct, answered: finished.answered });
      void pushSync(stateRef.current, reached);
    },
    [pushSync],
  );

  /** Chốt chặng: chấm ngay tại máy, 0 ms chờ mạng. */
  const closeStage = useCallback(
    (current: Record<string, AnswerValue>) => {
      if (!run || outcome) return;
      deadlineRef.current = 0;
      setConfirmClose(false);
      const graded = gradeStage(run, current);
      const nextState = applyResults(stateRef.current, graded.outcome.results);
      setState(nextState);
      void writeCachedState(nextState);
      setOutcome(graded.outcome);
      setRun(graded.run);
      setPickedBoon(undefined);
      if (graded.run.finished) finishRun(graded.run, graded.outcome);
    },
    [run, outcome, finishRun],
  );

  useEffect(() => {
    onTimeUpRef.current = () => closeStage(answers);
  }, [closeStage, answers]);

  function confirmIdentity() {
    const name = formName.trim();
    const credential = formCredential.trim();
    if (name.length < 2 || credential.length < 4) {
      toast.error("Nhập họ tên và 4 số cuối điện thoại hoặc ngày sinh.");
      return;
    }
    saveQuickLogin({ name, credential });
    setEntry({ name, credential });
  }

  /** Lưu lựa chọn bộ đề; mảng rỗng nghĩa là dùng tất cả. */
  function savePacks(next: string[]) {
    const all = next.length === quizList.length ? [] : next;
    setPacks(all);
    try {
      window.localStorage.setItem(PACKS_KEY, JSON.stringify(all));
    } catch {
      /* không lưu được thì vẫn dùng cho phiên hiện tại */
    }
  }

  function togglePack(id: string) {
    const current = packs.length ? packs : quizList.map((q) => q.id);
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    if (!next.length) {
      toast.error("Giữ ít nhất một bộ đề để vào ca trực.");
      return;
    }
    savePacks(next);
  }

  function begin() {
    if (!bank) return;
    try {
      const scoped = filterBankByQuizzes(bank, packs);
      if (!scoped.questions.length) {
        toast.error("Các bộ đề đang chọn chưa có câu hỏi — hãy chọn thêm bộ đề khác.");
        return;
      }
      const fresh = createRun(scoped, state, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      setRun(fresh);
      setIdx(0);
      setAnswers({});
      setOutcome(null);
      setSummary(null);
      setPickedBoon(undefined);
      deadlineRef.current = Date.now() + stageSeconds(fresh.boons) * 1000;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chưa có câu hỏi nghiệp vụ để ôn tập.");
    }
  }

  function nextStage() {
    if (!run) return;
    const next = takeBoon(run, pickedBoon);
    setRun(next);
    setIdx(next.stage * QUESTIONS_PER_STAGE);
    setOutcome(null);
    deadlineRef.current = Date.now() + stageSeconds(next.boons) * 1000;
  }

  const stage = outcome ? Math.max(0, (run?.stage ?? 1) - 1) : (run?.stage ?? 0);
  const question = run?.questions[idx];
  const stageFrom = stage * QUESTIONS_PER_STAGE;
  const inStagePos = idx - stageFrom + 1;
  const totalStages = run ? Math.ceil(run.questions.length / QUESTIONS_PER_STAGE) : STAGES_PER_RUN;
  const totals = useMemo(() => runBoonTotals(run?.boons ?? []), [run?.boons]);
  const quizList = useMemo(() => bankQuizzes(bank), [bank]);
  const scopedCount = useMemo(
    () => (bank ? filterBankByQuizzes(bank, packs).questions.length : 0),
    [bank, packs],
  );
  const blanks = run
    ? run.questions.slice(stageFrom, stageFrom + QUESTIONS_PER_STAGE).filter((_, i) => {
        const v = answers[String(stageFrom + i)];
        return v === undefined || v === null || v === "";
      }).length
    : 0;

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
          <button
            type="button"
            onClick={() => void pushSync(stateRef.current, 0)}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition hover:text-primary"
          >
            <CloudOff className="size-3.5" /> Tiến trình chưa gửi — bấm để thử lại
          </button>
        )}
      </div>

      {!entry && (
        <section className="mx-auto w-full max-w-md space-y-4 rounded-2xl border bg-card/70 p-6">
          <div className="text-center">
            <p className="font-heading text-lg font-extrabold">Vào ca trực</p>
            <p className="type-meta mt-1">
              Nhập đúng thông tin đã đăng ký — không cần vào phòng thi trước.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tower-name">Họ và tên</Label>
            <Input
              id="tower-name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Nguyễn Văn A"
              autoComplete="name"
              className="h-11 rounded-xl"
            />
          </div>
          <CredentialInput value={formCredential} onChange={setFormCredential} onEnter={confirmIdentity} />
          <Button className="h-11 w-full rounded-full" onClick={confirmIdentity}>
            <Castle className="mr-2 size-4" /> Mở Tháp Không Lưu
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
              : `${dueCount} thẻ đang đến hạn ôn · ${scopedCount} câu sẽ dùng cho ca trực`}
          </p>
          {!loading && !bank?.questions.length && (
            <p className="type-meta mt-1 text-amber-600">
              Gói nghiệp vụ chưa có câu hỏi nào — hãy thử lại khi có mạng.
            </p>
          )}

          {quizList.length > 1 && (
            <div className="mt-5 rounded-xl border bg-background/60 p-4 text-left">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Chọn bộ đề cho ca trực (có thể chọn nhiều)</p>
                <button
                  type="button"
                  onClick={() => savePacks([])}
                  className="type-meta underline underline-offset-2 transition hover:text-primary"
                >
                  Chọn tất cả
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {quizList.map((q) => {
                  const on = packs.length === 0 || packs.includes(q.id);
                  return (
                    <button
                      key={q.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => togglePack(q.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        on
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      {q.title} <span className="tabular-nums opacity-70">· {q.count}</span>
                    </button>
                  );
                })}
              </div>
              <p className="type-meta mt-2">
                {packs.length === 0
                  ? "Đang trộn câu hỏi của tất cả bộ đề."
                  : `Đang trộn ${packs.length} bộ đề đã chọn.`}
              </p>
            </div>
          )}

          <Button className="mt-4" disabled={loading || !bank?.questions.length} onClick={begin}>
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
            <Button onClick={begin}>
              <RefreshCw className="mr-2 size-4" /> Vào ca trực mới
            </Button>
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
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Trợ giúp cho tầng sau">
                {run.offered.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    role="radio"
                    aria-checked={pickedBoon === b.id}
                    onClick={() => setPickedBoon(b.id)}
                    className={cn(
                      "rounded-xl border p-3 text-left text-sm transition hover:border-primary",
                      pickedBoon === b.id && "border-primary bg-primary/5 ring-2 ring-primary/30",
                    )}
                  >
                    <div className="font-semibold">{b.name}</div>
                    <div className="type-meta">{b.desc}</div>
                  </button>
                ))}
              </div>
              {!pickedBoon && (
                <p className="type-meta mt-2">Chưa chọn cũng được — bạn vẫn lên tầng bình thường.</p>
              )}
            </div>
          )}

          {!summary && (
            <Button onClick={nextStage}>
              Lên {stageName(run.stage)} <ArrowRight className="ml-2 size-4" />
            </Button>
          )}
          {summary && outcome.softStop && (
            <p className="type-meta">
              Ca trực khép lại sớm ở đây để bạn ôn kỹ phần còn vướng — không sao cả, lần sau nhẹ hơn.
            </p>
          )}
        </section>
      )}

      {run && !summary && !outcome && question && (
        <section className="space-y-4 rounded-2xl border bg-card/70 p-5">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {stageName(stage)} ({stage + 1}/{totalStages}) · câu {inStagePos}/{QUESTIONS_PER_STAGE}
            </span>
            <HpBarLite hp={run.hp} shield={run.shield} />
            {run.combo > 1 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                <Flame className="size-3" /> Chuỗi {run.combo}
              </span>
            ) : null}
            {totals.damageBonus > 0 ? (
              <span className="type-meta">+{totals.damageBonus} sát thương</span>
            ) : null}
            <span
              ref={clockRef}
              className={cn(
                "ml-auto font-mono text-sm tabular-nums",
                lowTime && "font-bold text-destructive",
              )}
            />
          </div>

          {/* Bản đồ câu trong tầng: nhìn là biết còn câu nào bỏ trống. */}
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: QUESTIONS_PER_STAGE }).map((_, i) => {
              const at = stageFrom + i;
              const v = answers[String(at)];
              const done = v !== undefined && v !== null && v !== "";
              return (
                <button
                  key={at}
                  type="button"
                  onClick={() => setIdx(at)}
                  aria-label={`Câu ${i + 1}${done ? " — đã trả lời" : " — chưa trả lời"}`}
                  aria-current={at === idx}
                  className={cn(
                    "size-8 rounded-lg border text-xs font-semibold transition",
                    at === idx && "ring-2 ring-primary",
                    done ? "border-primary/40 bg-primary/10 text-primary" : "bg-background text-muted-foreground",
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
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

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={inStagePos <= 1} onClick={() => setIdx((i) => Math.max(stageFrom, i - 1))}>
              <ArrowLeft className="mr-2 size-4" /> Câu trước
            </Button>
            {inStagePos < QUESTIONS_PER_STAGE ? (
              <Button onClick={() => setIdx((i) => i + 1)}>
                Câu tiếp theo <ArrowRight className="ml-2 size-4" />
              </Button>
            ) : (
              <Button onClick={() => (blanks > 0 ? setConfirmClose(true) : closeStage(answers))}>
                Chốt {stageName(stage)}
              </Button>
            )}
          </div>
        </section>
      )}

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Còn {blanks} câu chưa trả lời</AlertDialogTitle>
            <AlertDialogDescription>
              Câu bỏ trống sẽ bị tính là sai và bạn mất máu. Bạn muốn quay lại làm nốt chứ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Quay lại làm tiếp</AlertDialogCancel>
            <AlertDialogAction onClick={() => closeStage(answers)}>Vẫn chốt tầng</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
