import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Dices, Link2, Loader2, LogOut, Swords, Wifi, WifiOff, X } from "lucide-react";
import { toast } from "sonner";

import { DuelFighter } from "@/components/arena/DuelFighter";
import { QuestionInput } from "@/components/exam/QuestionInput";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageContainer } from "@/components/ui-kit";
import { useDuelChannel } from "@/hooks/useDuelChannel";
import { arenaAnswer, arenaLeave, arenaReady } from "@/lib/arena.functions";
import { getArenaToken } from "@/lib/arena/client";
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
  useEffect(() => {
    const t = getArenaToken();
    if (!t) void navigate({ to: "/dau-truong" });
    else setToken(t);
  }, [navigate]);

  const { state, live, error, refresh } = useDuelChannel({ duelId, token, enabled: !!token });

  const sendReady = useServerFn(arenaReady);
  const sendAnswer = useServerFn(arenaAnswer);
  const sendLeave = useServerFn(arenaLeave);

  const [value, setValue] = useState<AnswerValue | undefined>();
  const [locked, setLocked] = useState(false);
  const roundRef = useRef(-1);

  // Mỗi câu mới thì xoá lựa chọn cũ.
  useEffect(() => {
    if (!state) return;
    if (state.currentRound !== roundRef.current) {
      roundRef.current = state.currentRound;
      setValue(undefined);
      setLocked(false);
    }
  }, [state]);

  const me = state?.players.find((p) => p.employeeId === state?.you);
  const foe = state?.players.find((p) => p.employeeId !== me?.employeeId);

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
        <DuelFighter player={me} hpStart={state.hpStart} mine hitKey={me?.hp} />
        <div className="flex flex-col items-center text-xs text-muted-foreground">
          <Swords className="size-5 text-primary" />
          <span>
            Câu {Math.min(state.currentRound + 1, state.roundCount)}/{state.roundCount}
          </span>
          <span className="flex items-center gap-1">
            {live ? (
              <>
                <Wifi className="size-3 text-emerald-500" /> trực tiếp
              </>
            ) : (
              <>
                <WifiOff className="size-3 text-amber-500" /> dự phòng
              </>
            )}
          </span>
        </div>
        <DuelFighter player={foe} hpStart={state.hpStart} hitKey={foe?.hp} />
      </header>

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
          onChange={setValue}
          onSubmit={async (v) => {
            setLocked(true);
            try {
              await sendAnswer({
                data: { token, duelId, roundIndex: state.currentRound, value: v as never },
              });
              await refresh(true);
            } catch (e) {
              setLocked(false);
              toast.error(e instanceof Error ? e.message : "Không gửi được đáp án.");
            }
          }}
        />
      ) : null}

      {state.lastResult && state.lastResult.roundIndex === state.currentRound ? (
        <ResultPanel state={state} meId={me?.employeeId} />
      ) : null}

      {state.status === "finished" && state.finish ? (
        <FinishPanel state={state} meId={me?.employeeId} />
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
  onChange,
  onSubmit,
}: {
  state: DuelState;
  value: AnswerValue | undefined;
  locked: boolean;
  onChange: (v: AnswerValue) => void;
  onSubmit: (v: AnswerValue) => void;
}) {
  const q = state.question!;
  const total = state.secondsPerRound * 1000;
  const [remain, setRemain] = useState(total);
  useEffect(() => {
    if (!state.roundServedAt) return;
    const skew = Date.now() - Date.parse(state.serverNow);
    const end = Date.parse(state.roundServedAt) + total;
    const id = window.setInterval(() => setRemain(Math.max(0, end + skew - Date.now())), 100);
    return () => window.clearInterval(id);
  }, [state.roundServedAt, state.serverNow, total]);

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
        <p className="text-center text-sm text-muted-foreground">Đã chốt — chờ đối thủ…</p>
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
      <p className="text-sm">
        Đáp án đúng: <strong>{r.correctText}</strong>
      </p>
      <p className="text-sm text-muted-foreground">
        ❤️ Máu của bạn: <strong>{mine?.hp ?? state.hpStart}</strong> · Đối thủ:{" "}
        <strong>{foe?.hp ?? state.hpStart}</strong>
      </p>
      {r.explanation ? <p className="text-sm text-muted-foreground">{r.explanation}</p> : null}
    </div>
  );
}

function FinishPanel({ state, meId }: { state: DuelState; meId?: string }) {
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
      <Button asChild variant="outline" className="rounded-full">
        <Link to="/dau-truong/xem-lai/$duelId" params={{ duelId: state.duelId }}>
          Xem lại diễn biến
        </Link>
      </Button>
    </div>
  );
}

