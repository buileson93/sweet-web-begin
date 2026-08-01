import { ErrorState } from "@/components/ui-kit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Castle,
  CloudOff,
  Coins,
  Flame,
  Heart,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import { QuestionInput } from "@/components/exam/QuestionInput";
import { TowerMap } from "@/components/tower/TowerMap";
import { HpBar } from "@/components/tower/HpBar";
import { InventorySheet } from "@/components/tower/InventorySheet";
import { TowerGuide } from "@/components/tower/TowerGuide";
import { BlessingCards } from "@/components/tower/BlessingCards";
import { CurseOffer } from "@/components/tower/CurseOffer";
import { ScoreSources } from "@/components/tower/ScoreSources";
import { RunTimeline } from "@/components/tower/RunTimeline";
import { saveRunRecord } from "@/lib/tower/history";
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
import { SectionHeading } from "@/components/ui-kit";
import { ArenaHero, ArenaPage } from "@/components/arena/ArenaPage";
import { readExamEntry } from "@/lib/examSession";
import { readQuickLogin, saveQuickLogin } from "@/lib/quickLogin";
import { CredentialInput } from "@/components/CredentialInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AnswerValue } from "@/lib/questionKinds";
import { bankIsStale, bankQuizzes, filterBankByQuizzes, type QuestionBank } from "@/lib/tower/bank";
import { START_HP } from "@/lib/tower/config";
import { bossAt } from "@/lib/tower/bosses";
import { curseById } from "@/lib/tower/curses";
import { FLOORS, mapFor, ROOM_META } from "@/lib/tower/map";
import { COMBO_REWARDS, ROOM_RULES } from "@/lib/tower/rooms";
import { ASCENSION_RULES, canBuy, UNLOCKS } from "@/lib/tower/meta";
import { dailySeed } from "@/lib/tower/rng";
import { BOARD_LABEL, runCoins, type Board } from "@/lib/tower/score";
import { vnDayKey } from "@/lib/arena/rules";
import { RARITY_LABEL, relicById } from "@/lib/tower/relics";
import {
  buyAtShop,
  challengeQuestion,
  chooseRoom,
  floorChoices,
  resolveChallenge,
  createRun,
  eventAt,
  gradeStage,
  leaveRoom,
  resolveEvent,
  restAtCampfire,
  roomQuestions,
  roomSeconds,
  runModifiers,
  shopStock,
  skipBlessing,
  takeCurse,
  takeRelic,
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
import { getTowerBankFn, getTowerBoardFn, openTowerFn, submitTowerRunScoreFn, syncTowerFn } from "@/lib/tower.functions";
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
          "Leo tháp 12 tầng phân nhánh: chọn phòng, gom di vật, nhận lời nguyền và hạ ba con trùm có luật riêng.",
      },
      { property: "og:title", content: "Tháp Không Lưu (TWR ATC) — Hội thi trắc nghiệm VATM" },
      {
        property: "og:description",
        content: "Mỗi hành trình sinh từ một hạt ngẫu nhiên: bản đồ, di vật và lời nguyền không lần nào giống nhau.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const RESUME_KEY = "vatm:tower:resume";
const PACKS_KEY = "vatm:tower:packs";
/** Tiến trình meta giữa các hành trình: xu tích luỹ, mở khoá, độ thăng thiên. */
const META_KEY = "vatm:tower:meta";

type Meta = { coins: number; unlocked: string[]; ascension: number; wins: number };
const EMPTY_META: Meta = { coins: 0, unlocked: [], ascension: 0, wins: 0 };

function readMeta(): Meta {
  try {
    const raw = window.localStorage.getItem(META_KEY);
    return raw ? { ...EMPTY_META, ...(JSON.parse(raw) as Partial<Meta>) } : EMPTY_META;
  } catch {
    return EMPTY_META;
  }
}

type Resume = {
  run: TowerRun;
  idx: number;
  answers: Record<string, AnswerValue>;
  deadline: number;
  savedAt?: number;
};

/** Tiến trình còn hiệu lực trong 24 giờ — đóng tab hay hết pin vẫn quay lại được. */
const RESUME_TTL_MS = 24 * 60 * 60 * 1000;

function readResume(): Resume | null {
  try {
    const raw = window.localStorage.getItem(RESUME_KEY) ?? window.sessionStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Resume;
    if (!parsed?.run?.questions?.length || parsed.run.finished) return null;
    if (parsed.savedAt && Date.now() - parsed.savedAt > RESUME_TTL_MS) return null;
    // Hành trình lưu từ bản cũ (bản đồ chưa có đồ thị) thì bỏ, tránh lỗi khi đọc lối đi.
    if (!Array.isArray(parsed.run.trail) || !Array.isArray(parsed.run.map?.[0]?.[0]?.next)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearResume() {
  try {
    window.localStorage.removeItem(RESUME_KEY);
    window.sessionStorage.removeItem(RESUME_KEY);
  } catch {
    /* không xoá được thì lần sau đọc vẫn có TTL chặn */
  }
}


/** Chuyển màn thì đưa người chơi lên đầu nội dung, không bắt cuộn tay. */
function toTop() {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Thanh trạng thái hành trình: máu, xu, di vật, lời nguyền — dính đầu màn hình trên điện thoại. */
function RunBar({ run }: { run: TowerRun }) {
  return (
    <div className="sticky top-1 z-30 flex flex-wrap items-center gap-2 rounded-2xl border bg-card/90 px-2.5 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
        Tầng {Math.min(run.floor, FLOORS)}/{FLOORS}
      </span>
      <HpBar hp={run.hp} max={run.maxHp} shield={run.shield} className="grow basis-40" />
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
        <Coins className="size-3" /> {run.coins}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <InventorySheet run={run} />
        <TowerGuide />
      </div>
    </div>
  );
}


function TowerPage() {
  const openTower = useServerFn(openTowerFn);
  const fetchBank = useServerFn(getTowerBankFn);
  const sync = useServerFn(syncTowerFn);
  const submitScore = useServerFn(submitTowerRunScoreFn);
  const fetchBoard = useServerFn(getTowerBoardFn);

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
  const [pickedRelic, setPickedRelic] = useState<string | undefined>(undefined);
  const [note, setNote] = useState<string>("");
  const [summary, setSummary] = useState<{
    floors: number;
    score: number;
    correct: number;
    answered: number;
    win: boolean;
    hp: number;
    relics: string[];
    curses: string[];
    ascension: number;
    seed: string;
    log: TowerRun["log"];
  } | null>(
    null,
  );
  const [challengeValue, setChallengeValue] = useState<AnswerValue | undefined>(undefined);
  const [confirmClose, setConfirmClose] = useState(false);
  const [lowTime, setLowTime] = useState(false);
  /** Khi đang ở trong phòng, bản đồ được thu lại; người chơi mở xem khi cần. */
  const [mapOpen, setMapOpen] = useState(false);

  const [meta, setMeta] = useState<Meta>(EMPTY_META);
  const [daily, setDaily] = useState(false);
  const [board, setBoard] = useState<Board>("tu-do");
  const [boardRows, setBoardRows] = useState<{ rank: number; name: string; unit: string; score: number; floors: number; win: boolean }[]>([]);

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
    setMeta(readMeta());
    const resume = readResume();
    if (resume) {
      setRun(resume.run);
      setIdx(resume.idx);
      setAnswers(resume.answers);
      // Đồng hồ cũ đã hết hạn thì cấp lại trọn thời gian phòng, tránh nộp ngay khi vừa mở lại.
      const fresh = resume.run.room && resume.run.room.questions > 0;
      deadlineRef.current =
        resume.deadline > Date.now() ? resume.deadline : fresh ? Date.now() + roomSeconds(resume.run) * 1000 : 0;
      toast.message(
        `Đã khôi phục hành trình: tầng ${Math.min(resume.run.floor, FLOORS)}/${FLOORS} · ${resume.run.hp}/${resume.run.maxHp} máu · ${resume.run.relics.length} di vật.`,
      );
    }
  }, []);

  const inCombat = Boolean(run && !summary && !outcome && run.room && run.room.questions > 0);


  // Đồng hồ: chỉ chạy vòng rAF khi thật sự đang làm bài, ghi thẳng vào DOM.
  useEffect(() => {
    if (!inCombat) return;
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
  }, [inCombat]);

  // Lưu tiến trình (tầng, phòng đã qua, máu, di vật, chuỗi combo) để quay lại không mất trạng thái.
  useEffect(() => {
    if (!run || summary) {
      clearResume();
      return;
    }
    const payload: Resume = { run, idx, answers, deadline: deadlineRef.current, savedAt: Date.now() };
    try {
      window.localStorage.setItem(RESUME_KEY, JSON.stringify(payload));
    } catch {
      /* bộ nhớ đầy thì bỏ qua, không chặn người chơi */
    }
  }, [run, idx, answers, summary]);


  useEffect(() => {
    try {
      window.localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch {
      /* không lưu được thì chỉ mất tiến trình meta của phiên này */
    }
  }, [meta]);

  // Bảng xếp hạng hành trình — tải lại khi đổi bảng hoặc khi vừa kết thúc.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const rows = await fetchBoard({ data: { board } });
        if (alive) setBoardRows(rows);
      } catch {
        if (alive) setBoardRows([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [board, fetchBoard, summary]);

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

  useEffect(() => {
    const retry = () => {
      if (!pendingRef.current) return;
      void pushSync(stateRef.current, 0);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [pushSync]);

  const finishRun = useCallback(
    (finished: TowerRun) => {
      const floors = Math.max(0, Math.min(FLOORS, finished.floor - 1));
      setSummary({
        floors,
        score: finished.score,
        correct: finished.correct,
        answered: finished.answered,
        win: finished.win,
        hp: finished.hp,
        relics: finished.relics,
        curses: finished.curses,
        ascension: finished.ascension,
        seed: finished.seed,
        log: finished.log,
      });
      void pushSync(stateRef.current, floors);

      // Lưu lại ngay tại máy để xem lại và thống kê được cả khi mất mạng.
      const startedMs = Date.parse(finished.startedAt);
      saveRunRecord({
        id: `${finished.seed}-${startedMs}`,
        seed: finished.seed,
        daily: finished.daily,
        ascension: finished.ascension,
        startedAt: finished.startedAt,
        finishedAt: new Date().toISOString(),
        seconds: Number.isFinite(startedMs) ? Math.max(0, Math.round((Date.now() - startedMs) / 1000)) : 0,
        floors,
        hp: finished.hp,
        maxHp: finished.maxHp,
        correct: finished.correct,
        answered: finished.answered,
        coins: finished.coins,
        relics: finished.relics,
        curses: finished.curses,
        win: finished.win,
        score: finished.score,
        log: finished.log,
      });


      const earned = runCoins(finished.score, 0);
      setMeta((m) => ({
        ...m,
        coins: m.coins + earned + finished.coins,
        wins: m.wins + (finished.win ? 1 : 0),
      }));

      const creds = credentials();
      if (creds) {
        void submitScore({
          data: {
            ...creds,
            seed: finished.seed,
            daily: finished.daily,
            floors,
            hp: finished.hp,
            relics: finished.relics,
            curses: finished.curses,
            ascension: finished.ascension,
            win: finished.win,
          },
        }).catch(() => undefined);
      }
    },
    [pushSync, credentials, submitScore],
  );

  /** Chốt phòng giao tranh: chấm ngay tại máy, 0 ms chờ mạng. */
  const closeRoom = useCallback(
    (current: Record<string, AnswerValue>) => {
      if (!run || outcome || !run.room) return;
      deadlineRef.current = 0;
      setConfirmClose(false);
      const graded = gradeStage(run, current);
      const nextState = applyResults(stateRef.current, graded.outcome.results);
      setState(nextState);
      void writeCachedState(nextState);
      setOutcome(graded.outcome);
      setRun(graded.run);
      setPickedRelic(undefined);
      if (graded.run.finished) finishRun(graded.run);
    },
    [run, outcome, finishRun],
  );

  useEffect(() => {
    onTimeUpRef.current = () => closeRoom(answers);
  }, [closeRoom, answers]);

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
      toast.error("Giữ ít nhất một bộ đề để vào hành trình.");
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
      const seed = daily ? dailySeed(vnDayKey(Date.now())) : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const fresh = createRun(scoped, state, seed, new Date(), {
        daily,
        ascension: meta.ascension,
        unlocked: meta.unlocked,
      });
      setRun(fresh);
      setIdx(0);
      setAnswers({});
      setOutcome(null);
      setSummary(null);
      setNote("");
      setPickedRelic(undefined);
      deadlineRef.current = 0;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chưa có câu hỏi nghiệp vụ để ôn tập.");
    }
  }

  /** Bước vào phòng đã chọn ở tầng hiện tại (nhận chỉ số nút trên bản đồ). */
  function enterRoom(nodeIndex: number) {
    if (!run) return;
    const at = floorChoices(run).findIndex((c) => c.index === nodeIndex);
    if (at < 0) return;
    const next = chooseRoom(run, at);
    setRun(next);
    setIdx(0);
    setAnswers({});
    setNote("");
    setChallengeValue(undefined);
    setMapOpen(false);
    deadlineRef.current = next.room && next.room.questions > 0 ? Date.now() + roomSeconds(next) * 1000 : 0;
    toTop();
  }

  /** Rời màn rút kinh nghiệm: nhận di vật đã chọn rồi lên tầng tiếp theo. */
  function continueUp() {
    if (!run) return;
    const next = pickedRelic ? takeRelic(run, pickedRelic) : skipBlessing(run);
    setRun(next);
    setOutcome(null);
    setPickedRelic(undefined);
    toTop();
    if (next.finished) finishRun(next);
  }

  const quizList = useMemo(() => bankQuizzes(bank), [bank]);
  // Bản đồ hạt hằng ngày để xem trước — lấy từ bộ nhớ đệm theo hạt nên không tốn công dựng lại.
  const previewMap = useMemo(() => mapFor(dailySeed(vnDayKey(Date.now()))), []);
  const scopedCount = useMemo(() => (bank ? filterBankByQuizzes(bank, packs).questions.length : 0), [bank, packs]);
  const mods = useMemo(() => (run ? runModifiers(run) : null), [run]);
  const roomQs = useMemo(() => (run && run.room ? roomQuestions(run) : []), [run]);
  const question = roomQs[idx];
  const perRoom = roomQs.length;
  const blanks = roomQs.filter((_, i) => {
    const v = answers[String(i)];
    return v === undefined || v === null || v === "";
  }).length;

  const boss = run?.room?.kind === "boss" ? bossAt(run.floor) : undefined;
  const showPicker = Boolean(run && !summary && !outcome && !run.room);
  // Phòng không giao tranh chỉ mở nội dung sau khi trả lời câu thử thách kiến thức.
  const challengeQ = run && run.room && run.challenge && !run.challenge.done ? challengeQuestion(run) : null;
  const nonCombat = run?.room && run.room.questions === 0 && run.challenge?.done ? run.room.kind : null;
  /** Đang ở trong một phòng: che bản đồ để người chơi chỉ thấy nội dung cần xử lý. */
  const inRoom = Boolean(run && !summary && !outcome && run.room);


  function submitChallenge() {
    if (!run) return;
    const res = resolveChallenge(run, challengeValue as AnswerValue);
    setRun(res.run);
    setChallengeValue(undefined);
    if (res.result) {
      const nextState = applyResults(stateRef.current, [res.result]);
      setState(nextState);
      void writeCachedState(nextState);
    }
    if (res.message) (res.correct ? toast.success : toast.warning)(res.message);
    if (res.run.finished) finishRun(res.run);
  }

  return (
    <ArenaPage>
      <ArenaHero
        icon={Castle}
        title="Tháp Không Lưu (TWR ATC)"
        description="12 tầng phân nhánh, 3 con trùm có luật riêng — gom di vật, cân nhắc lời nguyền."
      />

      <div className="flex flex-wrap items-center gap-2">
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
            <p className="font-heading text-lg font-extrabold">Vào tháp tu luyện</p>
            <p className="type-meta mt-1">Nhập đúng thông tin đã đăng ký — không cần vào phòng thi trước.</p>
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
            Xin chào <strong>{entry.name}</strong>. Một hành trình 12 tầng khoảng 15–20 phút, không tính vào kết quả kỳ thi.
          </p>
          <p className="type-meta mt-1">
            {loading
              ? "Đang chuẩn bị gói nghiệp vụ cho bạn…"
              : `${dueCount} thẻ đang đến hạn ôn · ${scopedCount} câu sẽ dùng cho hành trình`}
          </p>
          {!loading && !bank?.questions.length && (
            <p className="type-meta mt-1 text-amber-600">Gói nghiệp vụ chưa có câu hỏi nào — hãy thử lại khi có mạng.</p>
          )}

          {quizList.length > 1 && (
            <div className="mt-5 rounded-xl border bg-background/60 p-4 text-left">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Chọn bộ đề cho hành trình (có thể chọn nhiều)</p>
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
                        on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      {q.title} <span className="tabular-nums opacity-70">· {q.count}</span>
                    </button>
                  );
                })}
              </div>
              <p className="type-meta mt-2">
                {packs.length === 0 ? "Đang trộn câu hỏi của tất cả bộ đề." : `Đang trộn ${packs.length} bộ đề đã chọn.`}
              </p>
            </div>
          )}


          <div className="mt-5 grid gap-3 text-left sm:grid-cols-2">
            <div className="rounded-xl border bg-background/60 p-4">
              <p className="text-sm font-semibold">Thử thách hằng ngày</p>
              <p className="type-meta mt-1">
                Cùng một hạt ngẫu nhiên cho cả cơ quan: bản đồ, di vật và lời nguyền giống hệt nhau, ai chơi khéo hơn thì thắng.
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant={daily ? "default" : "outline"} onClick={() => setDaily(true)}>
                  Hạt hằng ngày
                </Button>
                <Button size="sm" variant={daily ? "outline" : "default"} onClick={() => setDaily(false)}>
                  Hạt tự do
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-background/60 p-4">
              <p className="text-sm font-semibold">Độ thăng thiên</p>
              <p className="type-meta mt-1">
                {meta.ascension === 0
                  ? "Cấp 0 — luật tiêu chuẩn."
                  : ASCENSION_RULES[meta.ascension - 1] ?? "Cấp cao nhất."}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Array.from({ length: 11 }).map((_, lv) => (
                  <button
                    key={lv}
                    type="button"
                    disabled={lv > 0 && meta.wins < 1}
                    onClick={() => setMeta((m) => ({ ...m, ascension: lv }))}
                    className={cn(
                      "size-8 rounded-lg border text-xs font-semibold transition disabled:opacity-40",
                      meta.ascension === lv ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
                    )}
                  >
                    {lv}
                  </button>
                ))}
              </div>
              {meta.wins < 1 && <p className="type-meta mt-1">Chinh phục đỉnh tháp một lần để mở độ thăng thiên.</p>}
            </div>
          </div>

          <div className="mt-3 rounded-xl border bg-background/60 p-4 text-left">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Kho mở khoá</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600">
                <Coins className="size-3" /> {meta.coins} xu tích luỹ
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {UNLOCKS.filter((u) => u.kind !== "ascension").map((u) => {
                const owned = meta.unlocked.includes(u.id);
                const buyable = canBuy(u, meta.coins, meta.wins, meta.unlocked);
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={!buyable}
                    onClick={() =>
                      setMeta((m) => ({ ...m, coins: m.coins - u.cost, unlocked: [...m.unlocked, u.id] }))
                    }
                    className={cn(
                      "rounded-xl border p-3 text-left text-sm transition disabled:opacity-50",
                      owned ? "border-emerald-500/40 bg-emerald-500/5" : "hover:border-primary",
                    )}
                  >
                    <div className="font-semibold">{u.name}</div>
                    <div className="type-meta">{u.desc}</div>
                    <div className="type-meta opacity-70">{owned ? "Đã mở khoá" : `${u.cost} xu`}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Xem trước toàn bộ 12 tầng của hạt hằng ngày trước khi bước vào. */}
          {daily && (
            <div className="mt-3 text-left">
              <p className="mb-2 text-sm font-semibold">Bản đồ hôm nay — xem trước 12 tầng</p>
              <TowerMap map={previewMap} floor={1} trail={[]} canPick={false} preview />
            </div>
          )}

          <Button className="mt-4" disabled={loading || !bank?.questions.length} onClick={begin}>
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Castle className="mr-2 size-4" />}
            Vào tháp tu luyện
          </Button>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <TowerGuide />
            <Button asChild size="sm" variant="ghost">
              <Link to="/dau-truong/bang-thap">Bảng xếp hạng tháp</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/dau-truong/thong-ke-thap">Thống kê hành trình</Link>
            </Button>
          </div>

        </section>
      )}

      {run && summary && (
        <section className="space-y-4 rounded-2xl border bg-card/70 p-6">
          <SectionHeading title={summary.win ? "Chinh phục đỉnh tháp!" : "Hành trình khép lại"} />
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Tầng đã qua", value: summary.floors },
              { label: "Điểm hành trình", value: summary.score },
              { label: "Câu đúng", value: summary.correct },
              { label: "Thẻ còn đến hạn", value: dueCount },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border bg-background/60 p-3 text-center">
                <div className="text-2xl font-bold tabular-nums">{s.value}</div>
                <div className="type-meta">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-background/60 p-3">
              <p className="mb-2 text-sm font-semibold">Điểm đến từ đâu</p>
              <ScoreSources
                input={{
                  floorsCleared: summary.floors,
                  hp: summary.hp,
                  relics: summary.relics,
                  curses: summary.curses,
                  ascension: summary.ascension,
                }}
              />
              <p className="type-meta mt-2">Hạt hành trình: <span className="font-mono">{summary.seed}</span></p>
            </div>
            <div className="rounded-xl border bg-background/60 p-3">
              <p className="mb-2 text-sm font-semibold">Xem lại diễn biến</p>
              <div className="max-h-72 overflow-y-auto pr-1">
                <RunTimeline log={summary.log} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={begin}>
              <RefreshCw className="mr-2 size-4" /> Hành trình mới
            </Button>
            <Button asChild variant="outline">
              <Link to="/dau-truong/thong-ke-thap">Thống kê &amp; xem lại</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/dau-truong/bang-thap">Bảng xếp hạng tháp</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/dau-truong">Nghỉ một chút</Link>
            </Button>
          </div>
        </section>
      )}

      {run && !summary && <RunBar run={run} />}

      {/* Đang trong phòng: bản đồ thu lại thành một nút, tránh phải cuộn để chơi. */}
      {run && !summary && inRoom && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            aria-expanded={mapOpen}
            aria-controls="tower-map-panel"
            onClick={() => setMapOpen((v) => !v)}
          >
            <Map className="mr-1.5 size-4" /> {mapOpen ? "Ẩn bản đồ" : "Xem bản đồ"}
          </Button>
        </div>
      )}

      {/* Bản đồ phân nhánh: xem toàn cảnh 12 tầng và chọn phòng cho tầng hiện tại. */}
      {run && !summary && (showPicker || mapOpen) && (
        <section id="tower-map-panel" className="space-y-3 rounded-2xl border bg-card/70 p-4 sm:p-5">
          <SectionHeading
            title={showPicker ? `Tầng ${run.floor} — chọn đường đi` : `Bản đồ hành trình · tầng ${Math.min(run.floor, FLOORS)}/${FLOORS}`}
          />
          <TowerMap
            map={run.map}
            floor={run.floor}
            trail={run.trail}
            canPick={Boolean(showPicker)}
            onPick={(i) => enterRoom(i)}
          />
          {showPicker ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {floorChoices(run).map(({ index, room }, i) => {
                const meta = ROOM_META[room.kind];
                const bossHere = room.kind === "boss" ? bossAt(run.floor) : undefined;
                return (
                  <button
                    key={`${room.kind}-${index}`}
                    type="button"
                    onClick={() => enterRoom(index)}
                    style={{ animationDelay: `${i * 90}ms` }}
                    className={cn(
                      "group relative min-h-20 touch-manipulation overflow-hidden rounded-2xl border p-3 text-left",
                      "animate-fade-in bg-gradient-to-br from-primary/10 to-transparent",
                      "transition-transform duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-lg active:scale-[0.98]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full bg-primary/10 blur-xl transition-opacity duration-300 group-hover:opacity-100 sm:opacity-0"
                    />
                    <div aria-hidden className="relative text-2xl transition-transform duration-200 group-hover:scale-110">
                      {meta.icon}
                    </div>
                    <div className={cn("relative mt-1 text-sm font-semibold", meta.tone)}>
                      {bossHere ? bossHere.name : meta.label}
                    </div>
                    <div className="type-meta relative mt-0.5">{bossHere ? bossHere.rule : ROOM_RULES[room.kind].rule}</div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>
      )}



      {/* Câu thử thách kiến thức của phòng sự kiện / cửa hàng / lửa trại */}
      {run && run.room && challengeQ && !summary && (
        <section className="space-y-4 rounded-2xl border bg-card/70 p-5">
          <SectionHeading
            title={`${ROOM_META[run.room.kind].icon} Thử thách ${ROOM_META[run.room.kind].label}`}
          />
          <p className="type-meta">{ROOM_RULES[run.room.kind].rule}</p>
          <div className="text-base font-medium">
            <RichText>{challengeQ.question}</RichText>
          </div>
          <QuestionInput
            kind={challengeQ.kind}
            options={challengeQ.options}
            optionImages={challengeQ.optionImages}
            matchLeft={challengeQ.pairs.map((pp) => pp.left)}
            value={challengeValue}
            onChange={setChallengeValue}
          />
          <div className="flex justify-end">
            <Button onClick={submitChallenge}>
              Trả lời <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </section>
      )}

      {/* Lửa trại */}
      {run && nonCombat === "campfire" && !summary && (
        <section className="space-y-3 rounded-2xl border bg-card/70 p-5">
          <SectionHeading title="🔥 Lửa trại" />
          <p className="type-meta">Nghỉ chân trước khi đi tiếp. Chọn một việc duy nhất.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setRun(restAtCampfire(run, "heal"))} disabled={mods?.noHeal}>
              Hồi máu
            </Button>
            <Button variant="outline" onClick={() => setRun(restAtCampfire(run, "upgrade"))}>
              Rèn khiên (+15)
            </Button>
          </div>
          {mods?.noHeal && <p className="type-meta text-destructive">Hồi máu đang bị vô hiệu — hãy rèn khiên.</p>}
        </section>
      )}

      {/* Sự kiện */}
      {run && nonCombat === "event" && !summary && (
        <section className="space-y-3 rounded-2xl border bg-card/70 p-5">
          {(() => {
            const ev = eventAt(run);
            return (
              <>
                <SectionHeading title={`${ev.icon} ${ev.title}`} />
                <p className="text-sm text-muted-foreground">{ev.text}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ev.choices.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        const res = resolveEvent(run, c.id);
                        setRun(res.run);
                        toast.message(res.message);
                        if (res.run.finished) finishRun(res.run);
                      }}
                      className="rounded-xl border p-3 text-left text-sm transition hover:border-primary"
                    >
                      <div className="font-semibold">{c.label}</div>
                      <div className="type-meta">{c.hint}</div>
                    </button>
                  ))}
                </div>
              </>
            );
          })()}
        </section>
      )}

      {/* Cửa hàng */}
      {run && nonCombat === "shop" && !summary && (
        <section className="space-y-3 rounded-2xl border bg-card/70 p-5">
          <SectionHeading title="🏪 Cửa hàng giữa tháp" />
          <p className="type-meta">Bạn đang có {run.coins} xu.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {shopStock(run).relics.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  const res = buyAtShop(run, { kind: "relic", relicId: r.id });
                  setRun(res.run);
                  toast.message(res.message);
                }}
                className="rounded-xl border p-3 text-left text-sm transition hover:border-primary"
              >
                <div className="font-semibold">
                  {r.icon} {r.name}
                </div>
                <div className="type-meta">
                  {r.desc} · {RARITY_LABEL[r.rarity]}
                </div>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const res = buyAtShop(run, { kind: "heal" });
                setRun(res.run);
                toast.message(res.message);
              }}
            >
              Hồi 30 máu · {shopStock(run).healCost} xu
            </Button>
            {run.curses.map((id) => (
              <Button
                key={id}
                variant="outline"
                onClick={() => {
                  const res = buyAtShop(run, { kind: "cleanse", curseId: id });
                  setRun(res.run);
                  toast.message(res.message);
                }}
              >
                Gỡ {curseById(id)?.name} · {shopStock(run).cleanseCost} xu
              </Button>
            ))}
            <Button
              onClick={() => {
                const next = leaveRoom(run);
                setRun(next);
                if (next.finished) finishRun(next);
              }}
            >
              Rời cửa hàng <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </section>
      )}

      {/* Rút kinh nghiệm + ban phước + lời nguyền */}
      {run && outcome && (
        <section className="space-y-4 rounded-2xl border bg-card/70 p-6">
          <SectionHeading title="Góc rút kinh nghiệm" />
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
              Mất {outcome.hpLost} máu
            </span>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Gây {outcome.damage} sát thương
            </span>
            {outcome.combos.map((c) => (
              <span
                key={c.at}
                className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600"
              >
                {c.label}
              </span>
            ))}
          </div>
          <ul className="space-y-2">
            {outcome.results.map((r, i) => (
              <li
                key={`${r.questionId}-${i}`}
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
            <BlessingCards
              offered={run.offered}
              picked={pickedRelic}
              onPick={setPickedRelic}
              onConfirm={continueUp}
              onSkip={() => {
                setPickedRelic(undefined);
                const next = skipBlessing(run);
                setRun(next);
                setOutcome(null);
                if (next.finished) finishRun(next);
              }}
            />
          )}

          {!summary && run.curseOffer && (
            <CurseOffer
              curseId={run.curseOffer.curseId}
              coins={run.curseOffer.coins}
              onAccept={() => setRun(takeCurse(run, true))}
              onDecline={() => setRun(takeCurse(run, false))}
            />
          )}

          {!summary && (
            <Button onClick={continueUp}>
              Lên tầng {Math.min(run.floor, FLOORS)} <ArrowRight className="ml-2 size-4" />
            </Button>
          )}
          {summary && !summary.win && (
            <p className="type-meta">Hành trình dừng ở đây để bạn ôn kỹ phần còn vướng — lần sau nhẹ hơn.</p>
          )}
        </section>
      )}

      {/* Phòng giao tranh / tinh anh / trùm */}
      {run && !summary && !outcome && run.room && perRoom > 0 && question && (
        <section className="space-y-4 rounded-2xl border bg-card/70 p-5">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {ROOM_META[run.room.kind].icon} {boss ? boss.name : ROOM_META[run.room.kind].label} · câu {idx + 1}/{perRoom}
            </span>
            {run.combo > 1 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                <Flame className="size-3" /> Chuỗi {run.combo}
              </span>
            ) : null}
            <span
              ref={clockRef}
              className={cn("ml-auto font-mono text-sm tabular-nums", lowTime && "font-bold text-destructive")}
            />
          </div>
          {boss && <p className="type-meta text-destructive">{boss.rule}</p>}
          <p className="type-meta">{ROOM_RULES[run.room.kind].rule}</p>
          <ul className="flex flex-wrap gap-1.5">
            {COMBO_REWARDS.map((c) => (
              <li
                key={c.at}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] font-medium transition",
                  run.combo >= c.at
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-600"
                    : "border-border text-muted-foreground",
                )}
              >
                {c.label}
              </li>
            ))}
          </ul>
          {note && <p className="type-meta">{note}</p>}

          <div className="flex flex-wrap gap-1.5">
            {roomQs.map((_, i) => {
              const v = answers[String(i)];
              const done = v !== undefined && v !== null && v !== "";
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIdx(i)}
                  aria-label={`Câu ${i + 1}${done ? " — đã trả lời" : " — chưa trả lời"}`}
                  aria-current={i === idx}
                  className={cn(
                    "size-8 rounded-lg border text-xs font-semibold transition",
                    i === idx && "ring-2 ring-primary",
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
            <Button variant="outline" disabled={idx <= 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
              <ArrowLeft className="mr-2 size-4" /> Câu trước
            </Button>
            {idx < perRoom - 1 ? (
              <Button onClick={() => setIdx((i) => i + 1)}>
                Câu tiếp theo <ArrowRight className="ml-2 size-4" />
              </Button>
            ) : (
              <Button onClick={() => (blanks > 0 ? setConfirmClose(true) : closeRoom(answers))}>Chốt phòng</Button>
            )}
          </div>
        </section>
      )}

      {!run && entry && (
        <section className="space-y-3 rounded-2xl border bg-card/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionHeading title="Bảng xếp hạng hành trình" />
            <div className="flex gap-2">
              {(["hang-ngay", "tu-do"] as Board[]).map((b) => (
                <Button key={b} size="sm" variant={board === b ? "default" : "outline"} onClick={() => setBoard(b)}>
                  {BOARD_LABEL[b]}
                </Button>
              ))}
            </div>
          </div>
          {boardRows.length === 0 ? (
            <p className="type-meta">Chưa có ai ghi tên vào bảng này. Hãy là người đầu tiên.</p>
          ) : (
            <ol className="space-y-1.5">
              {boardRows.map((r) => (
                <li key={`${r.rank}-${r.name}`} className="flex items-center gap-3 rounded-xl border bg-background/60 px-3 py-2 text-sm">
                  <span className="w-6 text-center font-bold tabular-nums">{r.rank}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {r.name} {r.win ? "👑" : ""}
                  </span>
                  <span className="type-meta truncate">{r.unit}</span>
                  <span className="tabular-nums font-semibold">{r.score}</span>
                  <span className="type-meta tabular-nums">tầng {r.floors}</span>
                </li>
              ))}
            </ol>
          )}
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
            <AlertDialogAction onClick={() => closeRoom(answers)}>Vẫn chốt phòng</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ArenaPage>
  );
}
