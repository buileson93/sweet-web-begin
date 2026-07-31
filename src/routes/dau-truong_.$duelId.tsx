import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Dices, Link2, Loader2, LogOut, RotateCcw, Share2, Swords, X } from "lucide-react";
import { toast } from "sonner";

import { DuelFighter } from "@/components/arena/DuelFighter";
import { BattleDice } from "@/components/arena/BattleDice";
import { ConnectionBadge } from "@/components/arena/ConnectionBadge";
import { SkillBar } from "@/components/arena/SkillBar";
import { QuestionInput } from "@/components/exam/QuestionInput";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageContainer } from "@/components/ui-kit";
import { useDuelChannel } from "@/hooks/useDuelChannel";
import { arenaAnswer, arenaCloseExpiredRound, arenaJoinDuel, arenaLeave, arenaReady, arenaRematch } from "@/lib/arena.functions";
import { getArenaToken } from "@/lib/arena/client";
import { getDeviceId } from "@/lib/deviceId";
import { skillById, type SkillId } from "@/lib/arena/skills";
import type { DuelPlayerView, DuelState } from "@/lib/arena/types";
import type { AnswerValue } from "@/lib/questionKinds";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dau-truong_/$duelId")({
  component: DuelRoom,
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

  const { state, error, refresh, latency, connectionStatus } = useDuelChannel({ duelId, token, enabled: !!token && joined });

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
  const expiringRef = useRef(false);

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

  // Thông báo trực tiếp: trúng đòn, ăn combo, đối thủ sắp gục.
  useEffect(() => {
    const r = state?.lastResult;
    if (!state || !r || r.roundIndex === announced.current) return;
    announced.current = r.roundIndex;
    if (r.dice?.length === 2) {
      setDice(r.dice);
      window.setTimeout(() => setDice([]), 2400);
    }
    const mineLine = r.lines.find((l) => l.employeeId === state.you);
    const foeLine = r.lines.find((l) => l.employeeId !== state.you);
    for (const n of r.skillNotes ?? []) toast.message(n.label);
    if (r.timedOut) toast.warning("⏱️ Hết giờ — không ai gây sát thương.");
    else if ((mineLine?.damage ?? 0) > 0)
      toast.success(`⚔️ Bạn gây ${mineLine!.damage} sát thương!`);
    else if ((foeLine?.damage ?? 0) > 0)
      toast.error(`💔 Bạn nhận ${foeLine!.damage} sát thương!`);
    const foeHp = foeLine?.hp ?? state.hpStart;
    const myHp = mineLine?.hp ?? state.hpStart;
    if (foeHp > 0 && foeHp <= state.hpStart * 0.25)
      toast.warning(`🔥 Đối thủ chỉ còn ${foeHp} máu — dứt điểm thôi!`);
    if (myHp > 0 && myHp <= state.hpStart * 0.25)
      toast.warning(`🩸 Bạn chỉ còn ${myHp} máu — cẩn thận!`);
  }, [state]);

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
    <PageContainer className="space-y-4 py-4">
      <header className="flex items-center gap-3">
        <DuelFighter
          player={me}
          hpStart={state.hpStart}
          mine
          skill={state.lastResult?.lines.find((l) => l.employeeId === me?.employeeId)?.skill}
        />
        <div className="flex shrink-0 flex-col items-center gap-1 text-xs text-muted-foreground">
          <Swords className="size-5 text-primary" />
          <span>
            Câu {Math.min(state.currentRound + 1, state.roundCount)}/{state.roundCount}
          </span>
          <ConnectionBadge status={connectionStatus} latency={latency} />
        </div>
        <DuelFighter
          player={foe}
          hpStart={state.hpStart}
          skill={state.lastResult?.lines.find((l) => l.employeeId === foe?.employeeId)?.skill}
        />
      </header>

      <BattleDice dice={dice} />

      {state.status === "waiting" || state.status === "countdown" ? (
        <WaitingPanel
          state={state}
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
          value={value}
          locked={locked || !!me?.answered}
          skill={skill}
          skillUses={me?.skillUses ?? []}
          onSkill={setSkill}
          onChange={setValue}
          onSubmit={async (v) => {
            setLocked(true);
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
              await refresh(true);
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
}: {
  state: DuelState;
  me?: DuelPlayerView;
  onReady: () => void;
}) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (state.status !== "countdown" || !state.startedAt) return;
    const target = Date.parse(state.startedAt);
    const skew = Date.now() - Date.parse(state.serverNow);
    const id = window.setInterval(
      () => setLeft(Math.max(0, Math.ceil((target + skew - Date.now()) / 1000))),
      200,
    );
    return () => window.clearInterval(id);
  }, [state.status, state.startedAt, state.serverNow]);

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
      <Button onClick={onReady} disabled={me?.ready} size="lg">
        {me?.ready ? <Check className="mr-2 size-4" /> : null}
        {me?.ready ? "Đã sẵn sàng" : "Sẵn sàng"}
      </Button>
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
}: {
  state: DuelState;
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
  const [remain, setRemain] = useState(total);
  const expiredRound = useRef(-1);
  useEffect(() => {
    if (!state.roundServedAt) return;
    const skew = Date.now() - Date.parse(state.serverNow);
    const end = Date.parse(state.roundServedAt) + total;
    const update = () => {
      const next = Math.max(0, end + skew - Date.now());
      setRemain(next);
      if (next <= 0 && expiredRound.current !== state.currentRound) {
        expiredRound.current = state.currentRound;
        window.setTimeout(onExpire, 1600);
      }
    };
    update();
    const id = window.setInterval(update, 100);
    return () => window.clearInterval(id);
  }, [state.currentRound, state.roundServedAt, state.serverNow, total, onExpire]);

  const pct = useMemo(() => Math.round((remain / total) * 100), [remain, total]);
  const single = q.kind === "single" || q.kind === "true_false";

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="space-y-1">
        <Progress value={pct} className={cn(pct < 30 && "[&>div]:bg-destructive")} />
        <p className="text-right font-mono text-xs text-muted-foreground">
          {(remain / 1000).toFixed(1)}s
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Kỹ năng — nạp trước khi chốt đáp án
        </p>
        <SkillBar
          uses={skillUses}
          currentRound={state.currentRound}
          selected={skill}
          disabled={locked}
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
        disabled={locked}
        onChange={(v) => {
          onChange(v);
          if (single) onSubmit(v);
        }}
      />
      {!single ? (
        <Button className="w-full" disabled={locked || value === undefined} onClick={() => onSubmit(value!)}>
          Chốt đáp án
        </Button>
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
              Elo {l.eloBefore} → <strong>{l.eloAfter}</strong>
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
      {!f.isRanked && f.rankedNote ? (
        <p className="text-xs text-muted-foreground">{f.rankedNote}</p>
      ) : null}
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

