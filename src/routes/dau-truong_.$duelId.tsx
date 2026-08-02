import { ErrorState } from "@/components/ui-kit";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Dices, Link2, Loader2, LogOut, RotateCcw, Share2, Swords, X } from "lucide-react";
import { toast } from "sonner";

import { ClassPicker } from "@/components/arena/ClassPicker";
import { DuelFighter } from "@/components/arena/DuelFighter";
import { BattleDice } from "@/components/arena/BattleDice";
import { RankedBadge } from "@/components/arena/RankedBadge";
import { ConnectionBadge } from "@/components/arena/ConnectionBadge";
import { NetStatsWidget } from "@/components/arena/NetStatsWidget";
import { DiagnosticsDialog } from "@/components/arena/DiagnosticsDialog";
import { SkillBar } from "@/components/arena/SkillBar";
import { WaitStatus } from "@/components/arena/WaitStatus";
import { QuestionInput } from "@/components/exam/QuestionInput";
import { Button } from "@/components/ui/button";
import { ArenaActionBar } from "@/components/arena/ArenaActionBar";
import { PageContainer } from "@/components/ui-kit";
import { useDuelChannel } from "@/hooks/useDuelChannel";
import {
  arenaAnswer,
  arenaChooseClass,
  arenaCloseExpiredRound,
  arenaJoinDuel,
  arenaLeave,
  arenaReady,
  arenaRematch,
} from "@/lib/arena.functions";
import { getArenaToken } from "@/lib/arena/client";
import { getDeviceId } from "@/lib/deviceId";
import { DEFAULT_CLASS, type ClassId } from "@/lib/arena/classes";
import { skillById, type SkillId } from "@/lib/arena/skills";
import type { DuelPlayerView, DuelState } from "@/lib/arena/types";
import type { AnswerValue } from "@/lib/questionKinds";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dau-truong_/$duelId")({
  component: DuelRoom,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <ErrorState error={error} />
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Phòng so tài 1vs1 — Hội thi trắc nghiệm VATM" },
      {
        name: "description",
        content: "Phòng so tài trực tiếp 1vs1: ai trả lời đúng trước sẽ gây sát thương, bên nào hết máu trước thì thua.",
      },
      { property: "og:title", content: "Phòng so tài 1vs1 — Hội thi trắc nghiệm VATM" },
      { property: "og:description", content: "Ván so tài tốc chiến 1vs1 đang diễn ra theo thời gian thực." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

/** Thời gian công bố kết quả phía máy chủ (ms) — phải khớp REVEAL_MS trong duel.server.ts. */
const REVEAL_MS = 2_000;
/** Ân hạn mạng trước khi nhắc máy chủ chốt câu (khớp NETWORK_GRACE_MS máy chủ). */
const NUDGE_GRACE_MS = 700;
/** Nhịp nhắc lại khi máy chủ chưa kịp chuyển bước. */
const NUDGE_INTERVAL_MS = 600;


function DuelRoom() {
  const { duelId } = Route.useParams();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [joined, setJoined] = useState(false);
  useEffect(() => {
    const t = getArenaToken();
    if (!t) {
      window.sessionStorage.setItem("arena:pending-duel", duelId);
      void navigate({ to: "/dau-truong" });
    }
    else setToken(t);
  }, [duelId, navigate]);

  const joinRoom = useServerFn(arenaJoinDuel);
  useEffect(() => {
    if (!token) return;
    void joinRoom({ data: { token, duelId, deviceHash: getDeviceId() } })
      .then(() => setJoined(true))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Không vào được phòng so tài."));
  }, [duelId, joinRoom, token]);

  const { state, error, refresh, latency, connectionStatus, predict, stats, diag, clock } =
    useDuelChannel({ duelId, token, enabled: !!token && joined });
  const [diagOpen, setDiagOpen] = useState(false);

  const setClass = useServerFn(arenaChooseClass);
  const sendReady = useServerFn(arenaReady);
  const sendAnswer = useServerFn(arenaAnswer);
  const sendLeave = useServerFn(arenaLeave);
  const closeExpired = useServerFn(arenaCloseExpiredRound);
  const rematch = useServerFn(arenaRematch);

  const [value, setValue] = useState<AnswerValue | undefined>();
  const [locked, setLocked] = useState(false);
  const [skill, setSkill] = useState<SkillId | null>(null);
  const roundRef = useRef(-1);
  const announced = useRef(-1);
  const [dice, setDice] = useState<number[]>([]);
  const [camShake, setCamShake] = useState(0);
  const expiringRef = useRef(false);
  /** Lần nhắc máy chủ gần nhất — chặn nhắc dồn dập khi trạng thái đổi liên tục. */
  const lastPumpRef = useRef(0);

  /** Dải diễn biến trong khung đấu — thay cho "bão" toast mỗi lượt. */
  const [battleLog, setBattleLog] = useState<{ id: number; tone: string; text: string }[]>([]);

  // Mỗi câu mới thì xoá lựa chọn cũ.
  useEffect(() => {
    if (!state) return;
    if (state.currentRound !== roundRef.current) {
      roundRef.current = state.currentRound;
      expiringRef.current = false;
      setValue(undefined);
      setLocked(false);
      setSkill(null);
    }
  }, [state]);

  const me = state?.players.find((p) => p.employeeId === state?.you);
  const foe = state?.players.find((p) => p.employeeId !== me?.employeeId);

  // Diễn biến trận: gộp mọi thông báo của một lượt vào MỘT dải log (không toast).
  useEffect(() => {
    const r = state?.lastResult;
    if (!state || !r || r.roundIndex === announced.current) return;
    announced.current = r.roundIndex;
    if (r.dice?.length === 2) {
      // Mốc do máy chủ cấp: hai bên thấy cùng kết quả và cùng thời điểm kết thúc.
      const total = r.revealMs ?? 2400;
      const startedAt = clock.toClientTime(r.resolvedAt, Date.now());
      const remain = startedAt + total - Date.now();
      if (remain > 250) {
        setDice(r.dice);
        window.setTimeout(() => setDice([]), remain);
      }
    }
    // Rung nhẹ toàn khung đấu theo mức sát thương của pha vừa rồi.
    const punch = Math.max(0, ...r.lines.map((l) => l.damage ?? 0));
    if (punch > 0) {
      setCamShake(punch);
      window.setTimeout(() => setCamShake(0), punch >= 16 ? 1200 : 500);
    }
    const mineLine = r.lines.find((l) => l.employeeId === state.you);
    const foeLine = r.lines.find((l) => l.employeeId !== state.you);
    const entries: { tone: string; text: string }[] = [];
    for (const n of r.skillNotes ?? []) entries.push({ tone: "skill", text: `✨ ${n.label}` });
    if (r.timedOut) entries.push({ tone: "warn", text: "⏱️ Hết giờ — không ai gây sát thương." });
    else if ((mineLine?.damage ?? 0) > 0)
      entries.push({ tone: "good", text: `⚔️ Bạn gây ${mineLine!.damage} sát thương!` });
    else if ((foeLine?.damage ?? 0) > 0)
      entries.push({ tone: "bad", text: `💔 Bạn nhận ${foeLine!.damage} sát thương!` });
    const foeHp = foeLine?.hp ?? state.hpStart;
    const myHp = mineLine?.hp ?? state.hpStart;
    if (foeHp > 0 && foeHp <= state.hpStart * 0.25)
      entries.push({ tone: "warn", text: `🔥 Đối thủ chỉ còn ${foeHp} máu — dứt điểm thôi!` });
    if (myHp > 0 && myHp <= state.hpStart * 0.25)
      entries.push({ tone: "warn", text: `🩸 Bạn chỉ còn ${myHp} máu — cẩn thận!` });
    if (entries.length) {
      const base = Date.now();
      setBattleLog((prev) =>
        [...entries.map((e, i) => ({ ...e, id: base + i })), ...prev].slice(0, 4),
      );
    }
  }, [state, clock]);

  // Bơm nhắc máy chủ cho MỌI pha có mốc giờ: hết đếm ngược (1-2-3 GO), hết giờ câu,
  // hết thời gian công bố kết quả. Khi mốc đã trôi qua mà trạng thái chưa đổi thì nhắc
  // lại mỗi 600ms cho tới khi máy chủ chuyển bước — không phải chờ nhịp watchdog 5 giây.
  // Máy chủ vẫn tự kiểm giờ nên lời nhắc này không thể làm sai luật.
  useEffect(() => {
    if (!token || !state) return;
    if (state.status !== "countdown" && state.status !== "playing") return;
    const r = state.lastResult;
    let deadline: number | null = null;
    if (state.status === "countdown") {
      deadline = state.startedAt ? clock.toClientTime(state.startedAt) : null;
    } else if (r?.resolvedAt && r.roundIndex === state.currentRound) {
      deadline = clock.toClientTime(r.resolvedAt) + REVEAL_MS + 150;
    } else if (state.roundServedAt) {
      deadline = clock.toClientTime(state.roundServedAt) + state.secondsPerRound * 1000 + NUDGE_GRACE_MS;
    }
    if (deadline === null) return;

    const round = state.currentRound;
    let stopped = false;
    let timer = 0;
    const pump = () => {
      if (stopped) return;
      lastPumpRef.current = Date.now();
      void closeExpired({ data: { token, duelId, roundIndex: round } })
        .then((r) => {
          if (r?.closed) void refresh(true);
        })
        .catch(() => undefined);

      timer = window.setTimeout(pump, NUDGE_INTERVAL_MS);
    };
    const wait = Math.max(0, deadline - Date.now());
    const gap = Math.max(0, NUDGE_INTERVAL_MS - (Date.now() - lastPumpRef.current));
    timer = window.setTimeout(pump, Math.max(wait, gap));
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [state, clock, closeExpired, refresh, token, duelId]);



  if (!token || !state)
    return (
      <PageContainer className="grid min-h-[60vh] place-items-center">
        {error ? (
          <div className="text-center">
            <p className="text-destructive">{error}</p>
            <Button className="mt-3" variant="outline" onClick={() => void refresh(true)}>
              Thử lại
            </Button>
          </div>
        ) : (
          <Loader2 className="size-8 animate-spin text-primary" />
        )}
      </PageContainer>
    );

  return (
    <PageContainer className="space-y-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <header
        className={cn(
          "flex items-center gap-3",
          camShake >= 16 ? "animate-cam-shake-hard" : camShake > 0 ? "animate-cam-shake" : "",
        )}
      >
        <DuelFighter
          player={me}
          hpStart={state.hpStart}
          mine
          roundKey={state.lastResult?.roundIndex ?? state.currentRound}
          skill={state.lastResult?.lines.find((l) => l.employeeId === me?.employeeId)?.skill}
        />
        <div className="flex w-16 shrink-0 flex-col items-center gap-1 text-center text-xs text-muted-foreground sm:w-auto">
          <Swords className="size-5 text-primary" />
          <span className="leading-tight">
            Câu {Math.min(state.currentRound + 1, state.roundCount)}/{state.roundCount}
          </span>
          <RankedBadge isRanked={state.isRanked} note={state.rankedNote} />
          <div className="hidden flex-col items-center gap-1 sm:flex">
            <ConnectionBadge status={connectionStatus} latency={latency} />
            <NetStatsWidget stats={stats} onOpenLog={() => setDiagOpen(true)} />
          </div>
        </div>
        <DuelFighter
          player={foe}
          hpStart={state.hpStart}
          roundKey={state.lastResult?.roundIndex ?? state.currentRound}
          skill={state.lastResult?.lines.find((l) => l.employeeId === foe?.employeeId)?.skill}
        />
      </header>

      {/* Trên điện thoại, chỉ số mạng nằm dưới khung đấu cho khỏi bóp méo bố cục. */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:hidden">
        <ConnectionBadge status={connectionStatus} latency={latency} />
        <NetStatsWidget stats={stats} onOpenLog={() => setDiagOpen(true)} />
      </div>

      <BattleDice dice={dice} />

      <WaitStatus
        state={state}
        me={me}
        foe={foe}
        connectionStatus={connectionStatus}
        latency={latency}
        toClientTime={clock.toClientTime}
      />

      {battleLog.length > 0 ? (
        <ul
          className="space-y-1 rounded-xl border bg-card/70 p-2 text-xs"
          aria-live="polite"
          aria-label="Diễn biến trận đấu"
        >
          {battleLog.map((l) => (
            <li
              key={l.id}
              className={cn(
                "animate-fade-in",
                l.tone === "good" && "text-primary",
                l.tone === "bad" && "text-destructive",
                l.tone === "warn" && "text-amber-500",
                l.tone === "skill" && "text-muted-foreground",
              )}
            >
              {l.text}
            </li>
          ))}
        </ul>
      ) : null}


      {state.status === "waiting" || state.status === "countdown" ? (
        <WaitingPanel
          state={state}
          toClientTime={clock.toClientTime}
          onChooseClass={(id) => {
            void setClass({ data: { token, duelId, classId: id } })
              .then(() => refresh(true))
              .catch((e) =>
                toast.error(e instanceof Error ? e.message : "Không đổi được lớp chiến binh."),
              );
          }}
          onReady={async () => {
            try {
              await sendReady({ data: { token, duelId } });
              await refresh(true);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Không sẵn sàng được.");
            }
          }}
          me={me}
        />
      ) : null}

      {state.status === "playing" && state.question ? (
        <RoundPanel
          state={state}
          toClientTime={clock.toClientTime}
          value={value}
          locked={locked || !!me?.answered}
          skill={skill}
          skillUses={me?.skillUses ?? []}
          onSkill={setSkill}
          onChange={setValue}
          onSubmit={async (v) => {
            setLocked(true);
            // Dự đoán phía client: hiện ngay "đã chốt" rồi đối chiếu lại khi máy chủ xác nhận.
            predict((prev) => ({
              ...prev,
              players: prev.players.map((p) =>
                p.employeeId === prev.you ? { ...p, answered: true } : p,
              ),
            }));
            try {
              await sendAnswer({
                data: {
                  token,
                  duelId,
                  roundIndex: state.currentRound,
                  value: v as never,
                  skill,
                },
              });
              // Không chờ vòng đồng bộ: giao diện đã khoá lạc quan từ trước,
              // trạng thái thật sẽ tới qua realtime hoặc lần đồng bộ ép ngay sau đây.
              void refresh(true);
            } catch (e) {
              setLocked(false);
              toast.error(e instanceof Error ? e.message : "Không gửi được đáp án.");
            }
          }}
          onExpire={() =>
            expiringRef.current
              ? undefined
              : (() => {
                  expiringRef.current = true;
                  void closeExpired({ data: { token, duelId, roundIndex: state.currentRound } })
                    .then(() => refresh(true))
                    .catch(() => { expiringRef.current = false; });
                })()
          }
        />
      ) : null}

      <DiagnosticsDialog
        open={diagOpen}
        onOpenChange={setDiagOpen}
        entries={diag}
        meta={{
          duelId,
          round: state.currentRound + 1,
          version: state.version,
          ping: stats.ping,
          skew: stats.skew,
          reconnects: stats.reconnects,
        }}
      />

      {state.lastResult && state.lastResult.roundIndex === state.currentRound ? (
        <ResultPanel state={state} meId={me?.employeeId} />
      ) : null}

      {state.status === "finished" && state.finish ? (
        <FinishPanel
          state={state}
          meId={me?.employeeId}
          onRematch={async () => {
            const next = await rematch({ data: { token, duelId, deviceHash: getDeviceId() } });
            toast.success("Đã gửi lời mời tái đấu.");
            void navigate({ to: "/dau-truong/$duelId", params: { duelId: next.duelId } });
          }}
        />
      ) : null}

      {state.status !== "finished" ? (
        <div className="pt-2 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await sendLeave({ data: { token, duelId } });
              void navigate({ to: "/dau-truong" });
            }}
          >
            <LogOut className="mr-2 size-4" /> Rời ván so tài
          </Button>
        </div>
      ) : (
        <div className="pt-2 text-center">
          <Button onClick={() => void navigate({ to: "/dau-truong" })}>Về đấu trường</Button>
        </div>
      )}
    </PageContainer>
  );
}

function WaitingPanel({
  state,
  me,
  onReady,
  onChooseClass,
  toClientTime,
}: {
  state: DuelState;
  toClientTime: (iso: string | null | undefined, fallback?: number) => number;
  me?: DuelPlayerView;
  onReady: () => void;
  onChooseClass: (id: ClassId) => void;
}) {
  const [left, setLeft] = useState(0);
  // 15 giây chọn lớp trước khi vào trận; hết giờ thì chốt lớp đang chọn.
  // Mốc hết giờ được neo theo phòng nên F5 hay chuyển tab đều không kéo dài thêm.
  const pickKey = `arena:pick-deadline:${state.duelId}`;
  const pickDeadline = useMemo(() => {
    const saved = Number(window.sessionStorage.getItem(pickKey) ?? 0);
    if (saved > Date.now() - 60_000 && saved > 0) return saved;
    const next = Date.now() + 15_000;
    window.sessionStorage.setItem(pickKey, String(next));
    return next;
  }, [pickKey]);
  const [pick, setPick] = useState(() => Math.max(0, Math.ceil((pickDeadline - Date.now()) / 1000)));
  const lockedClass = state.status === "countdown" || pick <= 0 || Boolean(me?.ready);
  useEffect(() => {
    if (state.status !== "waiting") return;
    const id = window.setInterval(
      () => setPick(Math.max(0, Math.ceil((pickDeadline - Date.now()) / 1000))),
      500,
    );
    return () => window.clearInterval(id);
  }, [state.status, pickDeadline]);
  useEffect(() => {
    if (state.status !== "countdown" || !state.startedAt) return;
    const target = toClientTime(state.startedAt);
    // Đặt ngay số giây đầu tiên (trước đây khởi tạo 0 nên nháy "GO!" rồi mới đếm 3-2-1).
    const tick = () => setLeft(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);

  }, [state.status, state.startedAt, toClientTime]);

  if (state.status === "countdown")
    return (
      <div className="grid place-items-center rounded-2xl border bg-card py-14">
        <p className="text-sm text-muted-foreground">Ván so tài bắt đầu sau</p>
        <p className="animate-pulse text-7xl font-black text-primary">{left || "GO!"}</p>
      </div>
    );

  return (
    <div className="grid place-items-center gap-3 rounded-2xl border bg-card py-12">
      <Loader2 className="size-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">
        {state.players.length < 2 ? "Đang chờ đối thủ vào phòng…" : "Chờ cả hai bấm sẵn sàng"}
      </p>
      <div className="w-full max-w-2xl px-3">
        <p className="mb-2 text-center text-xs text-muted-foreground">
          {lockedClass
            ? "Đã chốt lớp chiến binh cho ván này."
            : `Chọn lớp chiến binh — còn ${pick} giây`}
        </p>
        <ClassPicker
          value={(me?.classId as ClassId | undefined) ?? DEFAULT_CLASS}
          onChange={onChooseClass}
          disabled={lockedClass}
        />
      </div>

      <ArenaActionBar>
        <Button onClick={onReady} disabled={me?.ready} className="h-12 w-full rounded-xl text-base">
          {me?.ready ? <Check className="mr-2 size-4" /> : null}
          {me?.ready ? "Đã sẵn sàng" : "Sẵn sàng"}
        </Button>
      </ArenaActionBar>
      {state.players.length < 2 ? (
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const link = `${window.location.origin}/dau-truong/${state.duelId}`;
            try {
              await navigator.clipboard.writeText(link);
              toast.success("Đã sao chép liên kết vào phòng. Gửi cho đồng nghiệp là vào ngay!");
            } catch {
              toast.message(link);
            }
          }}
        >
          <Link2 className="mr-2 size-4" /> Sao chép liên kết mời
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Đồng hồ lượt đấu — chạy bằng requestAnimationFrame và ghi thẳng vào DOM.
 * Không dùng state nên không kéo theo việc vẽ lại câu hỏi/kỹ năng/nhân vật mỗi 100ms.
 */
const RoundClock = memo(function RoundClock({
  endAt,
  total,
  round,
  onExpire,
}: {
  endAt: number;
  total: number;
  round: number;
  onExpire: () => void;
}) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    if (!endAt) return;
    let raf = 0;
    let fired = false;
    const step = () => {
      const remain = Math.max(0, endAt - Date.now());
      const pct = total > 0 ? (remain / total) * 100 : 0;
      if (barRef.current) {
        barRef.current.style.width = `${pct}%`;
        barRef.current.style.backgroundColor =
          pct < 30 ? "hsl(var(--destructive))" : "hsl(var(--primary))";
      }
      if (textRef.current)
        textRef.current.textContent =
          remain <= 0 ? "⏱️ Hết giờ — đang chốt lượt…" : `${(remain / 1000).toFixed(1)}s`;
      if (remain <= 0) {
        if (!fired) {
          fired = true;
          expireRef.current();
        }
        return;
      }
      // Tab ẩn thì trình duyệt tự dừng rAF — không đốt CPU nền.
      raf = requestAnimationFrame(step);
    };
    step();
    return () => cancelAnimationFrame(raf);
  }, [endAt, total, round]);

  return (
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div ref={barRef} className="h-full w-full rounded-full bg-primary" />
      </div>
      <p ref={textRef} className="text-right font-mono text-xs text-muted-foreground" />
    </div>
  );
});

function RoundPanel({

  state,
  value,
  locked,
  skill,
  skillUses,
  onSkill,
  onChange,
  onSubmit,
  onExpire,
  toClientTime,
}: {
  state: DuelState;
  toClientTime: (iso: string | null | undefined, fallback?: number) => number;
  value: AnswerValue | undefined;
  locked: boolean;
  skill: SkillId | null;
  skillUses: { skill: string; round: number }[];
  onSkill: (s: SkillId | null) => void;
  onChange: (v: AnswerValue) => void;
  onSubmit: (v: AnswerValue) => void;
  onExpire: () => void;
}) {
  const q = state.question!;
  const total = state.secondsPerRound * 1000;
  // Đồng hồ chạy bằng requestAnimationFrame, ghi thẳng vào DOM (không setState 10 lần/giây).
  // React chỉ vẽ lại đúng MỘT lần cho mỗi câu: lúc hết giờ.
  const [timeUp, setTimeUp] = useState(false);
  const endAt = state.roundServedAt ? toClientTime(state.roundServedAt) + total : 0;
  useEffect(() => setTimeUp(false), [state.currentRound]);

  const single = q.kind === "single" || q.kind === "true_false";
  const frozen = locked || timeUp;

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <RoundClock
        endAt={endAt}
        total={total}
        round={state.currentRound}
        onExpire={() => {
          setTimeUp(true);
          onExpire();
        }}
      />

      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Kỹ năng — nạp trước khi chốt đáp án
        </p>
        <SkillBar
          uses={skillUses}
          currentRound={state.currentRound}
          selected={skill}
          disabled={frozen}
          onSelect={onSkill}
        />
      </div>
      <p className="text-lg font-semibold leading-snug">{q.question}</p>
      {q.imageUrl ? (
        <img
          src={q.imageUrl}
          alt="Hình minh hoạ câu hỏi"
          loading="lazy"
          className="mx-auto max-h-56 rounded-xl object-contain"
        />
      ) : null}
      <QuestionInput
        kind={q.kind}
        options={q.options}
        optionImages={q.optionImages}
        matchLeft={q.matchLeft}
        value={value}
        disabled={frozen}
        onChange={(v) => {
          onChange(v);
          if (single) onSubmit(v);
        }}
      />
      {!single ? (
        <ArenaActionBar>
          <Button
            className="h-12 w-full rounded-xl text-base"
            disabled={frozen || value === undefined}
            onClick={() => onSubmit(value!)}
          >
            Chốt đáp án
          </Button>
        </ArenaActionBar>
      ) : null}
      {locked ? (
        <p className="text-center text-sm text-muted-foreground">Đã chốt đáp án duy nhất của lượt này</p>
      ) : null}
    </div>
  );
}

function ResultPanel({ state, meId }: { state: DuelState; meId?: string }) {
  const r = state.lastResult!;
  const mine = r.lines.find((l) => l.employeeId === meId);
  const foe = r.lines.find((l) => l.employeeId !== meId);
  const dealt = mine?.damage ?? 0;
  const taken = foe?.damage ?? 0;

  return (
    <div
      className={cn(
        "space-y-1 rounded-2xl border p-4",
        r.neutral
          ? "border-border bg-muted/40"
          : dealt > 0
            ? "border-emerald-500/50 bg-emerald-500/10"
            : "border-rose-500/50 bg-rose-500/10",
      )}
    >
      <p className="flex items-center gap-2 font-semibold">
        {mine?.isCorrect ? (
          <Check className="size-5 text-emerald-600" />
        ) : (
          <X className="size-5 text-rose-600" />
        )}
        {r.neutral
          ? "Cả hai cùng chưa đúng — không ai mất máu"
          : dealt > 0
            ? `${mine?.firstCorrect ? "Nhanh tay nhất! " : ""}Gây ${dealt} sát thương ⚔️`
            : `Bị trừ ${taken} máu 💔`}
      </p>
      {r.dice?.length ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Dices className="size-4 text-primary" />
          Xúc xắc: <strong className="text-foreground">{r.dice.join(" + ")}</strong> ={" "}
          <strong className="text-foreground">{r.dice.reduce((a, b) => a + b, 0)}</strong> sát thương gốc
        </p>
      ) : null}
      <p className="text-sm">
        Đáp án đúng: <strong>{r.correctText}</strong>
      </p>
      <p className="text-sm text-muted-foreground">
        ❤️ Máu của bạn: <strong>{mine?.hp ?? state.hpStart}</strong> · Đối thủ:{" "}
        <strong>{foe?.hp ?? state.hpStart}</strong>
      </p>
      {r.skillNotes?.length ? (
        <ul className="space-y-0.5 text-sm">
          {r.skillNotes.map((n, i) => (
            <li key={i} className="font-medium text-primary">
              {n.label}
            </li>
          ))}
        </ul>
      ) : null}
      {r.timedOut ? (
        <p className="text-sm font-medium text-amber-600">⏱️ Hết giờ — cả hai đều bỏ trống câu này.</p>
      ) : null}
      {r.explanation ? <p className="text-sm text-muted-foreground">{r.explanation}</p> : null}
    </div>
  );
}

function FinishPanel({ state, meId, onRematch }: { state: DuelState; meId?: string; onRematch: () => Promise<void> }) {
  const f = state.finish!;
  const win = f.winnerEmployeeId === meId;
  const draw = f.winnerEmployeeId === null;
  const mine = f.lines.find((l) => l.employeeId === meId);
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-5 text-center">
      <p className="text-3xl font-black">
        {draw ? "🤝 Hoà!" : win ? "🏆 Chiến thắng!" : "😢 Thất bại"}
      </p>
      <p className="text-sm text-muted-foreground">{f.reasonLabel}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {f.lines.map((l) => (
          <div key={l.employeeId} className="rounded-xl border bg-muted/40 p-3">
            <p className="truncate font-semibold">{l.displayName}</p>
            <p className="font-mono text-2xl">❤️ {l.hp}</p>
            <p className="text-xs text-muted-foreground">
              ⚔️ {l.damageDealt} sát thương · Đúng {l.correct}/{state.roundCount}
            </p>
            <p className="text-xs text-muted-foreground">
              {f.isRanked ? (
                <>
                  Elo {l.eloBefore} → <strong>{l.eloAfter}</strong>{" "}
                  <span className={l.eloAfter > l.eloBefore ? "text-emerald-600" : l.eloAfter < l.eloBefore ? "text-rose-600" : ""}>
                    ({l.eloAfter - l.eloBefore >= 0 ? "+" : ""}
                    {l.eloAfter - l.eloBefore})
                  </span>
                </>
              ) : (
                <>Elo giữ nguyên {l.eloBefore}</>
              )}
            </p>
          </div>
        ))}
      </div>
      {mine?.coins ? <p className="text-sm">Nhận được {mine.coins} xu 🪙</p> : null}
      {mine?.newBadges.length ? (
        <p className="text-sm">
          Huy hiệu mới: {mine.newBadges.map((b) => `${b.icon} ${b.name}`).join(", ")}
        </p>
      ) : null}
      <div className="flex justify-center">
        <RankedBadge isRanked={f.isRanked} note={f.rankedNote} showReason />
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => void onRematch()} className="rounded-full">
          <RotateCcw className="mr-2 size-4" /> Tái đấu cùng bộ đề
        </Button>
        <Button variant="outline" className="rounded-full" onClick={() => void navigator.share?.({ title: "Thách đấu VATM", url: window.location.href }).catch(() => navigator.clipboard.writeText(window.location.href))}>
          <Share2 className="mr-2 size-4" /> Chia sẻ
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/dau-truong/xem-lai/$duelId" params={{ duelId: state.duelId }}>Xem lại diễn biến</Link>
        </Button>
        <Button asChild variant="ghost" className="rounded-full">
          <Link to="/dau-truong">Chọn lại bộ đề</Link>
        </Button>
      </div>
    </div>
  );
}

