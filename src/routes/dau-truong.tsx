import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Coins, Flame, Loader2, Swords, Trophy, User, X, Zap } from "lucide-react";
import { toast } from "sonner";

import { CredentialInput } from "@/components/CredentialInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageContainer, PageHero, SectionHeading } from "@/components/ui-kit";
import { arenaHome, arenaQuickMatch, arenaRespondInvite, arenaSignIn } from "@/lib/arena.functions";
import { clearArenaToken, getArenaToken, saveArenaToken } from "@/lib/arena/client";
import type { ArenaProfile } from "@/lib/arena/types";
import { getDeviceId } from "@/lib/deviceId";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dau-truong")({
  component: ArenaLobby,
  head: () => ({
    meta: [
      { title: "Đấu trường 1vs1 — Hội thi trắc nghiệm VATM" },
      {
        name: "description",
        content:
          "Thách đấu đồng nghiệp theo thời gian thực: 10 câu tốc chiến, tính điểm Elo, huy hiệu và bảng xếp hạng đấu trường.",
      },
      { property: "og:title", content: "Đấu trường 1vs1 — Hội thi trắc nghiệm VATM" },
      {
        property: "og:description",
        content: "Tốc chiến 1vs1, chấm điểm tức thì, xếp hạng Elo và huy hiệu cho nhân viên VATM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Home = Awaited<ReturnType<typeof arenaHome>>;

function ArenaLobby() {
  const navigate = useNavigate();
  const signIn = useServerFn(arenaSignIn);
  const loadHome = useServerFn(arenaHome);
  const quickMatch = useServerFn(arenaQuickMatch);
  const respond = useServerFn(arenaRespondInvite);

  const [token, setToken] = useState("");
  const [home, setHome] = useState<Home | null>(null);
  const [name, setName] = useState("");
  const [credential, setCredential] = useState("");
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const waitedRef = useRef(0);

  useEffect(() => {
    const saved = getArenaToken();
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    const pull = async () => {
      try {
        const data = await loadHome({ data: { token } });
        if (alive) setHome(data);
      } catch {
        if (alive) {
          clearArenaToken();
          setToken("");
        }
      }
    };
    void pull();
    const id = window.setInterval(pull, 6000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [token, loadHome]);

  // Tìm trận: hỏi lại mỗi 3 giây, càng chờ lâu càng nới rộng khoảng Elo.
  useEffect(() => {
    if (!searching || !token) return;
    let alive = true;
    const attempt = async () => {
      try {
        const res = await quickMatch({
          data: { token, waitedSeconds: waitedRef.current, deviceHash: getDeviceId() },
        });
        waitedRef.current += 3;
        if (!alive) return;
        const fresh = await loadHome({ data: { token } });
        setHome(fresh);
        if (!res.created) {
          setSearching(false);
          void navigate({ to: "/dau-truong/$duelId", params: { duelId: res.duelId } });
        } else {
          void navigate({ to: "/dau-truong/$duelId", params: { duelId: res.duelId } });
        }
      } catch (e) {
        if (!alive) return;
        setSearching(false);
        toast.error(e instanceof Error ? e.message : "Không tìm được trận.");
      }
    };
    void attempt();
    const id = window.setInterval(attempt, 3000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [searching, token, quickMatch, loadHome, navigate]);

  async function handleSignIn() {
    if (name.trim().length < 2 || credential.trim().length < 4) {
      toast.error("Nhập họ tên và 4 số cuối điện thoại hoặc ngày sinh.");
      return;
    }
    setBusy(true);
    try {
      const res = await signIn({ data: { name: name.trim(), credential: credential.trim() } });
      saveArenaToken(res.token, res.profile.displayName);
      setToken(res.token);
      toast.success(`Chào ${res.profile.displayName}, sẵn sàng chiến!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xác thực được.");
    } finally {
      setBusy(false);
    }
  }

  if (!token)
    return (
      <PageContainer className="py-8">
        <PageHero
          title="Đấu trường 1vs1"
          description="10 câu tốc chiến, ai nhanh và đúng hơn thì thắng."
        />
        <div className="mx-auto mt-6 w-full max-w-md rounded-2xl border bg-card/80 p-5 shadow-lg backdrop-blur">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="arena-name" className="flex items-center gap-2">
                <User className="size-4 text-primary" /> Họ và tên
              </Label>
              <Input
                id="arena-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                autoComplete="name"
              />
            </div>
            <CredentialInput value={credential} onChange={setCredential} onEnter={handleSignIn} />
            <Button className="w-full" onClick={handleSignIn} disabled={busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Swords className="mr-2 size-4" />}
              Vào đấu trường
            </Button>
          </div>
        </div>
      </PageContainer>
    );

  const profile = home?.profile;
  return (
    <PageContainer className="space-y-6 py-6">
      <PageHero
        title="Đấu trường 1vs1"
        description="Thách đấu đồng nghiệp, leo hạng Elo và sưu tầm huy hiệu."
      />

      {profile ? <ProfileStrip profile={profile} /> : null}

      <div className="flex flex-col items-center gap-3">
        {searching ? (
          <div className="flex flex-col items-center gap-2">
            <Button size="lg" variant="secondary" onClick={() => setSearching(false)}>
              <X className="mr-2 size-4" /> Huỷ tìm trận
            </Button>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang tìm đối thủ cùng trình độ…
            </p>
          </div>
        ) : (
          <Button
            size="lg"
            className="h-14 px-10 text-lg shadow-lg"
            onClick={() => {
              waitedRef.current = 0;
              setSearching(true);
            }}
          >
            <Zap className="mr-2 size-5" /> Tìm trận nhanh
          </Button>
        )}
      </div>

      {home?.invites.incoming.length ? (
        <section className="space-y-2">
          <SectionHeading title="Lời mời thách đấu" />
          {home.invites.incoming.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3"
            >
              <span className="font-medium">{inv.from_name} thách đấu bạn</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    const res = await respond({
                      data: { token, inviteId: inv.id, accept: true, deviceHash: getDeviceId() },
                    });
                    if (res.duelId)
                      void navigate({ to: "/dau-truong/$duelId", params: { duelId: res.duelId } });
                  }}
                >
                  Nhận
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void respond({ data: { token, inviteId: inv.id, accept: false } }).then(() =>
                      toast.message("Đã từ chối lời mời."),
                    )
                  }
                >
                  Từ chối
                </Button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2">
          <SectionHeading title="Bảng xếp hạng Elo" />
          <ol className="space-y-1.5">
            {(home?.leaderboard.players ?? []).map((p, i) => (
              <li
                key={`${p.rank}-${p.short_name}`}
                className={cn(
                  "flex items-center gap-3 rounded-xl border bg-card px-3 py-2",
                  i === 0 && "border-amber-400/60 bg-amber-500/10",
                )}
              >
                <span className="w-6 text-center font-bold text-muted-foreground">{i + 1}</span>
                <span className="text-lg">🧑‍✈️</span>
                <span className="min-w-0 flex-1 truncate font-medium">{p.short_name}</span>
                <span className="text-xs text-muted-foreground">{p.unit}</span>
                <span className="font-mono font-semibold text-primary">{p.elo}</span>
              </li>
            ))}
            {!home?.leaderboard.players.length ? (
              <li className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                Chưa có ai lên bảng. Hãy là người đầu tiên!
              </li>
            ) : null}
          </ol>
        </section>

        <section className="space-y-2">
          <SectionHeading title="Trận gần đây" />
          <ul className="space-y-1.5">
            {(home?.history ?? []).map((h) => (
              <li
                key={h.duelId}
                className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2 text-sm"
              >
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-semibold",
                    h.won
                      ? "bg-emerald-500/15 text-emerald-600"
                      : h.draw
                        ? "bg-muted text-muted-foreground"
                        : "bg-rose-500/15 text-rose-600",
                  )}
                >
                  {h.won ? "Thắng" : h.draw ? "Hoà" : "Thua"}
                </span>
                <span className="min-w-0 flex-1 truncate">vs {h.opponent}</span>
                <span className="font-mono">
                  {h.score}–{h.opponentScore}
                </span>
                <span
                  className={cn(
                    "w-12 text-right font-mono",
                    h.eloDelta >= 0 ? "text-emerald-600" : "text-rose-600",
                  )}
                >
                  {h.eloDelta >= 0 ? "+" : ""}
                  {h.eloDelta}
                </span>
              </li>
            ))}
            {!home?.history.length ? (
              <li className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                Chưa có trận nào.
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </PageContainer>
  );
}

function ProfileStrip({ profile }: { profile: ArenaProfile }) {
  const items = [
    { icon: Trophy, label: "Elo", value: profile.elo },
    { icon: Swords, label: "Thắng/Thua", value: `${profile.wins}/${profile.losses}` },
    { icon: Flame, label: "Chuỗi thắng", value: profile.streak },
    { icon: Coins, label: "Xu", value: profile.coins },
  ];
  return (
    <div className="rounded-2xl border bg-card/80 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-2xl">
          {profile.avatar || "🧑‍✈️"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{profile.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{profile.unit}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {items.map((it) => (
            <div key={it.label} className="rounded-xl bg-muted/50 px-3 py-1.5 text-center">
              <it.icon className="mx-auto size-4 text-primary" />
              <p className="text-sm font-semibold">{it.value}</p>
              <p className="text-[10px] uppercase text-muted-foreground">{it.label}</p>
            </div>
          ))}
        </div>
      </div>
      {profile.badges.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {profile.badges.map((b) => (
            <span
              key={b.code}
              title={b.name}
              className="rounded-full border bg-background px-2 py-0.5 text-xs"
            >
              {b.icon} {b.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
