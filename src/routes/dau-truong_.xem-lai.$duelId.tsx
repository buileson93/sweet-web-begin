import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BarChart3, Loader2, Swords, Trophy } from "lucide-react";

import { HpBar } from "@/components/arena/HpBar";
import { AvatarBubble } from "@/components/player/AvatarBubble";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHero, SectionHeading } from "@/components/ui-kit";
import { arenaReplay } from "@/lib/arena.functions";
import { getArenaToken } from "@/lib/arena/client";
import { levelTitle } from "@/lib/xp";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dau-truong_/xem-lai/$duelId")({
  component: DuelReplayPage,
  head: () => ({
    meta: [
      { title: "Xem lại ván so tài — Hội thi trắc nghiệm VATM" },
      {
        name: "description",
        content:
          "Diễn biến từng câu hỏi, sát thương, máu còn lại và kết quả chi tiết của ván so tài 1vs1.",
      },
      { property: "og:title", content: "Xem lại ván so tài — Hội thi trắc nghiệm VATM" },
      {
        property: "og:description",
        content: "Timeline sự kiện và kết quả chi tiết của ván so tài.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Replay = Awaited<ReturnType<typeof arenaReplay>>;

function DuelReplayPage() {
  const { duelId } = useParams({ from: "/dau-truong_/xem-lai/$duelId" });
  const navigate = useNavigate();
  const load = useServerFn(arenaReplay);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getArenaToken();
    if (!token) {
      void navigate({ to: "/dau-truong" });
      return;
    }
    let alive = true;
    load({ data: { token, duelId } })
      .then((res) => alive && setReplay(res))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Không tải được ván so tài."));
    return () => {
      alive = false;
    };
  }, [duelId, load, navigate]);

  if (error)
    return (
      <PageContainer className="grid min-h-[50vh] place-items-center text-center">
        <div className="space-y-3">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={() => void navigate({ to: "/dau-truong" })}>
            <ArrowLeft className="mr-2 size-4" /> Về đấu trường
          </Button>
        </div>
      </PageContainer>
    );

  if (!replay)
    return (
      <PageContainer className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </PageContainer>
    );

  const finishedText = replay.finishedAt
    ? new Date(replay.finishedAt).toLocaleString("vi-VN")
    : "—";

  return (
    <PageContainer className="space-y-6 py-6">
      <PageHero
        title="Xem lại ván so tài"
        description={`${replay.quizTitle} · ${replay.roundCount} câu · ${replay.isRanked ? "Xếp hạng" : "Giao hữu"} · ${finishedText}`}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {replay.players.map((p) => {
          const win = replay.winnerEmployeeId === p.employeeId;
          return (
            <div
              key={p.employeeId}
              className={cn(
                "space-y-2 rounded-2xl border bg-card p-4 shadow-sm",
                win && "border-amber-400 ring-2 ring-amber-300/40",
              )}
            >
              <div className="flex items-center gap-3">
                <AvatarBubble
                  name={p.displayName}
                  avatarUrl={p.avatarUrl}
                  avatarImage={p.avatarImage}
                  level={p.level}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate font-semibold">
                    {p.displayName}
                    {win ? <Trophy className="size-4 text-amber-500" /> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {levelTitle(p.level)} · {p.unit}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-mono font-semibold">
                    {p.eloAfter ?? p.eloBefore}
                    <span
                      className={cn(
                        "ml-1",
                        (p.eloAfter ?? p.eloBefore) - p.eloBefore >= 0
                          ? "text-emerald-600"
                          : "text-rose-600",
                      )}
                    >
                      ({(p.eloAfter ?? p.eloBefore) - p.eloBefore >= 0 ? "+" : ""}
                      {(p.eloAfter ?? p.eloBefore) - p.eloBefore})
                    </span>
                  </p>
                  <p className="text-muted-foreground">Elo</p>
                </div>
              </div>
              <HpBar hp={p.hp} hpStart={replay.hpStart} />
              <p className="text-xs text-muted-foreground">
                ⚔️ {p.damageDealt} sát thương · ✅ {p.correct} câu đúng · 🎯 {p.score} điểm
              </p>
            </div>
          );
        })}
      </div>

      <section className="space-y-3">
        <SectionHeading title="Diễn biến từng câu" />
        <ol className="relative space-y-3 border-l pl-4">
          {replay.rounds.map((r) => (
            <li key={r.index} className="relative rounded-2xl border bg-card p-3">
              <span className="absolute -left-[1.4rem] top-4 grid size-6 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {r.index + 1}
              </span>
              <p className="text-sm font-medium">{r.question}</p>
              {r.correctText ? (
                <p className="mt-1 text-xs text-emerald-600">Đáp án đúng: {r.correctText}</p>
              ) : null}
              {r.explanation ? (
                <p className="mt-1 text-xs text-muted-foreground">💡 {r.explanation}</p>
              ) : null}
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {r.lines.map((l) => (
                  <div
                    key={l.employeeId}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs",
                      l.isCorrect ? "bg-emerald-500/10" : "bg-muted",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{l.displayName}</span>
                    <span>{l.answered ? (l.isCorrect ? "✅" : "❌") : "⏱️"}</span>
                    {l.firstCorrect ? <span title="Nhanh tay nhất">⚡</span> : null}
                    <span className="tabular-nums text-muted-foreground">
                      {(l.msTaken / 1000).toFixed(1)}s
                    </span>
                    {l.damage > 0 ? (
                      <span className="font-semibold text-rose-600">-{l.damage} HP</span>
                    ) : null}
                    <span className="tabular-nums text-muted-foreground">❤️ {l.hpAfter}</span>
                  </div>
                ))}
              </div>
              {r.neutral ? (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Cả hai cùng chưa đúng — không ai mất máu.
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={() => void navigate({ to: "/dau-truong" })}>
          <Swords className="mr-2 size-4" /> Về đấu trường
        </Button>
        <Button variant="ghost" onClick={() => void navigate({ to: "/dau-truong/thong-ke" })}>
          <BarChart3 className="mr-2 size-4" /> Thống kê của tôi
        </Button>
      </div>
    </PageContainer>
  );
}
