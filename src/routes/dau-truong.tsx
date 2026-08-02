import { ErrorState } from "@/components/ui-kit";
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  BarChart3,
  Castle,
  Coins,
  Flame,
  Loader2,
  LogOut,
  PlayCircle,
  Search,
  Send,
  Swords,
  Trophy,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { BetaBadge } from "@/components/BetaBadge";
import { CredentialInput } from "@/components/CredentialInput";
import { InviteDialog } from "@/components/arena/InviteDialog";
import { ShareChallenge } from "@/components/arena/ShareChallenge";
import { BusyDuelDialog } from "@/components/arena/BusyDuelDialog";
import { ClassPicker, useWarriorClass } from "@/components/arena/ClassPicker";
import { PracticePanel } from "@/components/arena/PracticePanel";
import { DueBadge } from "@/components/arena/DueBadge";
import { useArenaInviteChannel } from "@/hooks/useArenaInviteChannel";
import { AvatarBubble } from "@/components/player/AvatarBubble";
import { usePlayerIdentity } from "@/hooks/usePlayerIdentity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArenaHero, ArenaPage } from "@/components/arena/ArenaPage";
import { SectionHeading } from "@/components/ui-kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  arenaEndActive,
  arenaHome,
  arenaInvite,
  arenaPresence,
  arenaQuickMatch,
  arenaRespondInvite,
  arenaSearchOpponents,
  arenaSignIn,
} from "@/lib/arena.functions";
import { clearArenaToken, getArenaToken, saveArenaToken } from "@/lib/arena/client";
import { parseBusyError, type BusyInfo } from "@/lib/arena/rooms";
import type { ArenaProfile } from "@/lib/arena/types";
import { getDeviceId } from "@/lib/deviceId";
import { readQuickLogin, saveQuickLogin } from "@/lib/quickLogin";
import { allSpriteUrls } from "@/lib/arena/sprites";

import { cn } from "@/lib/utils";


export const Route = createFileRoute("/dau-truong")({
  component: ArenaLobby,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <ErrorState error={error} />
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Đấu trường — Hội thi trắc nghiệm VATM" },
      {
        name: "description",
        content:
          "Thách đấu đồng nghiệp theo thời gian thực: 10 câu tốc chiến, tính điểm Elo, huy hiệu và bảng xếp hạng đấu trường.",
      },
      { property: "og:title", content: "Đấu trường — Hội thi trắc nghiệm VATM" },
      {
        property: "og:description",
        content: "Tốc chiến so tài, chấm điểm tức thì, xếp hạng Elo và huy hiệu cho nhân viên VATM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Home = Awaited<ReturnType<typeof arenaHome>>;
type Presence = Awaited<ReturnType<typeof arenaPresence>>;

function ArenaLobby() {
  const navigate = useNavigate();
  const { classId, choose: chooseClass } = useWarriorClass();
  const signIn = useServerFn(arenaSignIn);
  const loadHome = useServerFn(arenaHome);
  const quickMatch = useServerFn(arenaQuickMatch);
  const respond = useServerFn(arenaRespondInvite);
  const beat = useServerFn(arenaPresence);
  const endActive = useServerFn(arenaEndActive);

  const { save: saveIdentity } = usePlayerIdentity();
  const [token, setToken] = useState("");
  const [home, setHome] = useState<Home | null>(null);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [name, setName] = useState("");
  const [credential, setCredential] = useState("");
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const [searching, setSearching] = useState(false);
  const [dismissedInvites, setDismissedInvites] = useState<string[]>([]);
  const [busyDuel, setBusyDuel] = useState<BusyInfo | null>(null);
  const waitedRef = useRef(0);


  // Nạp sẵn toàn bộ sprite nhân vật ngay ở sảnh: vào trận không phải chờ tải ảnh.
  useEffect(() => {
    const imgs = allSpriteUrls().map((url) => {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      return img;
    });
    return () => {
      imgs.forEach((img) => {
        img.src = "";
      });
    };
  }, []);

  const autoSignInRef = useRef(false);
  useEffect(() => {
    const saved = getArenaToken();
    if (saved) {
      setToken(saved);
      return;
    }
    // Ghi nhớ 3 giờ: đã đăng nhập nhanh ở nơi khác thì vào thẳng đấu trường, khỏi nhập lại.
    const quick = readQuickLogin();
    if (!quick) return;
    setName((prev) => prev || quick.name);
    setCredential((prev) => prev || quick.credential);
    if (autoSignInRef.current) return;
    autoSignInRef.current = true;
    setBusy(true);
    signIn({ data: { name: quick.name, credential: quick.credential } })
      .then((res) => {
        saveArenaToken(res.token, res.profile.displayName);
        setToken(res.token);
      })
      .catch(() => {
        /* thông tin cũ không khớp — để người dùng nhập lại */
      })
      .finally(() => setBusy(false));
  }, [signIn]);



  useEffect(() => {
    if (!token) return;
    let alive = true;
    const pull = async () => {
      try {
        const data = await loadHome({ data: { token } });
        if (alive) {
          setHome(data);
          saveIdentity({
            employeeId: data.profile.employeeId,
            displayName: data.profile.displayName,
            unit: data.profile.unit,
            avatarUrl: data.profile.avatarUrl,
            avatarImage: data.profile.avatarImage,
            level: data.profile.level,
          });
        }
      } catch {
        if (alive) {
          clearArenaToken();
          setToken("");
        }
      }
    };
    void pull();
    // Sảnh chỉ cần làm mới thưa; bỏ qua nhịp khi tab đang ẩn để đỡ tải máy chủ.
    const id = window.setInterval(() => {
      if (!document.hidden) void pull();
    }, 12_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [token, loadHome, saveIdentity]);

  // Có lời mời mới -> nạp lại ngay, không phải chờ vòng hỏi lại 6 giây.
  useArenaInviteChannel(home?.profile.employeeId, () => {
    if (!token) return;
    void loadHome({ data: { token } })
      .then(setHome)
      .catch(() => undefined);
  });

  // Nhịp tim 20 giây: máy chủ xác nhận ai đang trực tuyến, đồng thời báo ván đang dang dở.
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const ping = async () => {
      try {
        const res = await beat({ data: { token } });
        if (alive) setPresence(res);
      } catch {
        /* bỏ qua nhịp lỗi, lần sau thử lại */
      }
    };
    void ping();
    const id = window.setInterval(ping, 20_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [token, beat]);


  // Tìm trận: hỏi lại mỗi 3 giây, càng chờ lâu càng nới rộng khoảng Elo.
  useEffect(() => {
    if (!searching || !token) return;
    let alive = true;
    const attempt = async () => {
      try {
        const res = await quickMatch({
          data: { token, waitedSeconds: waitedRef.current, deviceHash: getDeviceId(), classId },
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
        const raw = e instanceof Error ? e.message : "Không tìm được trận.";
        const info = parseBusyError(raw);
        if (info) setBusyDuel(info);
        else toast.error(raw);
      }
    };
    void attempt();
    const id = window.setInterval(attempt, 3000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [searching, token, quickMatch, loadHome, navigate, classId]);

  async function handleSignIn() {
    if (name.trim().length < 2 || credential.trim().length < 4) {
      toast.error("Nhập họ tên và 4 số cuối điện thoại hoặc ngày sinh.");
      return;
    }
    setBusy(true);
    try {
      const res = await signIn({ data: { name: name.trim(), credential: credential.trim() } });
      saveArenaToken(res.token, res.profile.displayName);
      saveQuickLogin({ name: name.trim(), credential: credential.trim() });
      setToken(res.token);
      toast.success(`Chào ${res.profile.displayName}, sẵn sàng chiến!`);
      const pendingDuel = window.sessionStorage.getItem("arena:pending-duel");
      if (pendingDuel) {
        window.sessionStorage.removeItem("arena:pending-duel");
        void navigate({ to: "/dau-truong/$duelId", params: { duelId: pendingDuel } });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xác thực được.");
    } finally {
      setBusy(false);
    }
  }

  if (!token)
    return (
      <ArenaPage>
        <ArenaHero
          icon={Swords}
          title={
            <span className="inline-flex flex-wrap items-center gap-2">
              Đấu trường <BetaBadge />
            </span>
          }
          description="10 câu tốc chiến, ai nhanh và đúng hơn thì thắng."
        />
        <div className="arena-panel arena-radar mx-auto w-full max-w-md overflow-hidden p-0">
          <div className="flex flex-col items-center gap-1 border-b border-border/60 bg-gradient-to-b from-primary/10 to-transparent px-6 py-6 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary shadow-[var(--shadow-ring)]">
              <Swords className="size-6" />
            </span>
            <p className="font-heading mt-2 text-lg font-extrabold">Vào sân đấu</p>
            <p className="type-meta max-w-xs">
              Nhập đúng thông tin đã đăng ký để ghép cặp và tính điểm Elo cho bạn.
            </p>
          </div>
          <div className="space-y-4 p-6">
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
                className="h-11 rounded-xl"
              />
            </div>
            <CredentialInput value={credential} onChange={setCredential} onEnter={handleSignIn} />
            <Button
              className="cta-glow h-11 w-full rounded-full text-base"
              onClick={handleSignIn}
              disabled={busy}
            >
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Swords className="mr-2 size-4" />}
              Vào đấu trường
            </Button>
          </div>
        </div>
      </ArenaPage>
    );

  const profile = home?.profile;
  const onlineCount = presence?.online.length ?? 0;
  return (
    <ArenaPage>
      <ArenaHero
        icon={Swords}
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            Đấu trường <BetaBadge />
          </span>
        }
        description="So tài cùng đồng nghiệp, leo hạng Elo và sưu tầm huy hiệu."
        aside={
          <Button asChild variant="secondary" size="sm" className="rounded-full">
            <Link to="/dau-truong/thong-ke">
              <BarChart3 className="mr-1.5 size-4" /> Thống kê
            </Link>
          </Button>
        }
      />

      <BusyDuelDialog
        busy={busyDuel}
        onClose={() => setBusyDuel(null)}
        onLeave={async () => {
          await endActive({ data: { token } });
          setPresence((p) => (p ? { ...p, active: null } : p));
        }}
        onLeft={() => setSearching(true)}
      />

      {profile ? <ProfileStrip profile={profile} /> : null}

      {presence?.active ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-amber-400/60 bg-amber-500/10 p-3 sm:flex sm:flex-wrap">
          <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <PlayCircle className="size-4 shrink-0 text-amber-600" />
            <span className="truncate">Đang so tài với {presence.active.opponent}</span>
          </p>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              onClick={() =>
                void navigate({
                  to: "/dau-truong/$duelId",
                  params: { duelId: presence.active!.duelId },
                })
              }
            >
              Vào tiếp
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={ending}
              onClick={async () => {
                setEnding(true);
                try {
                  await endActive({ data: { token } });
                  setPresence({ ...presence, active: null });
                  toast.success("Đã kết thúc ván so tài dang dở.");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Không kết thúc được.");
                } finally {
                  setEnding(false);
                }
              }}
            >
              {ending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <LogOut className="mr-1.5 size-4" />}
              Kết thúc
            </Button>
          </div>
        </div>
      ) : null}

      {/* Hai lối chơi chính nằm gọn trong một màn hình điện thoại, không phải cuộn tìm. */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {searching ? (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-primary/40 bg-primary/5 p-3">
            <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setSearching(false)}>
              <X className="mr-1.5 size-4" /> Huỷ tìm đối thủ
            </Button>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Đang tìm đối thủ cùng trình độ…
            </p>
          </div>
        ) : (
          <button
            type="button"
            disabled={Boolean(presence?.active)}
            onClick={() => {
              waitedRef.current = 0;
              setSearching(true);
            }}
            className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/20 via-card to-card p-3.5 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg disabled:pointer-events-none disabled:opacity-60"
          >
            <span className="cta-glow grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Zap className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">So tài nhanh</span>
              <span className="type-meta block truncate">Ghép cặp tự động theo Elo · 5 câu</span>
            </span>
            <ArrowRight className="ml-auto size-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
          </button>
        )}

        {/* Lối vào Tháp Không Lưu — gọn ngang, vẫn nổi bật ngay đầu trang. */}
        <Link
          to="/dau-truong/leo-thap"
          className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-amber-400/15 via-card to-card p-3.5 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600">
            <Castle className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-bold">
              Tháp Không Lưu <DueBadge />
            </span>
            <span className="type-meta block truncate">Ôn nghiệp vụ 12 tầng · không tính vào kỳ thi</span>
          </span>
          <ArrowRight className="ml-auto size-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      <InviteDialog
        invite={
          (home?.invites.incoming ?? []).find((i) => !dismissedInvites.includes(i.id)) ?? null
        }
        onAccept={async (inviteId) => {
          try {
            const res = await respond({
              data: { token, inviteId, accept: true, deviceHash: getDeviceId() },
            });
            setDismissedInvites((prev) => [...prev, inviteId]);
            if (res.duelId)
              void navigate({ to: "/dau-truong/$duelId", params: { duelId: res.duelId } });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Không nhận được lời mời.");
            setDismissedInvites((prev) => [...prev, inviteId]);
          }
        }}
        onDecline={async (inviteId) => {
          setDismissedInvites((prev) => [...prev, inviteId]);
          await respond({ data: { token, inviteId, accept: false } }).catch(() => undefined);
        }}
      />

      {/*
        Ba nhóm nội dung gộp vào thẻ chuyển tab: điện thoại chỉ cuộn trong một nhóm,
        máy tính vẫn thấy đủ nhờ lưới hai cột bên trong.
      */}
      <Tabs defaultValue="vao-tran" className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-xl">
          <TabsTrigger value="vao-tran" className="text-xs sm:text-sm">
            Vào trận
          </TabsTrigger>
          <TabsTrigger value="doi-thu" className="text-xs sm:text-sm">
            Đối thủ
            {onlineCount ? (
              <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">
                {onlineCount}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="xep-hang" className="text-xs sm:text-sm">
            Xếp hạng
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vao-tran" className="mt-3 space-y-3">
          <ClassPicker value={classId} onChange={chooseClass} disabled={searching} />
          <PracticePanel
            token={token}
            classId={classId}
            disabled={Boolean(presence?.active) || searching}
            onStarted={(duelId) => void navigate({ to: "/dau-truong/$duelId", params: { duelId } })}
          />
          <ShareChallenge token={token} />
        </TabsContent>

        <TabsContent value="doi-thu" className="mt-3 space-y-3">
          {home?.invites.incoming.length ? (
            <section className="space-y-2">
              <SectionHeading title="Lời mời thách đấu" />
              {home.invites.incoming.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {inv.from_name} thách đấu bạn
                  </span>
                  <div className="flex shrink-0 gap-1.5">
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

          <OnlineList
            token={token}
            players={presence?.online ?? []}
            disabled={Boolean(presence?.active)}
          />

          <ChallengeByName token={token} />
        </TabsContent>

        <TabsContent value="xep-hang" className="mt-3">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-2">
              <SectionHeading title="Bảng xếp hạng Elo" />
              <ol className="space-y-1.5">
                {(home?.leaderboard.players ?? []).map((p, i) => (
                  <li
                    key={`${p.rank}-${p.short_name}`}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border bg-card px-2.5 py-1.5",
                      i === 0 && "border-amber-400/60 bg-amber-500/10",
                    )}
                  >
                    <span className="w-5 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
                    <AvatarBubble name={p.short_name ?? ""} size="xs" live />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.short_name}</span>
                    <span className="hidden max-w-24 truncate text-xs text-muted-foreground sm:block">{p.unit}</span>
                    <span className="font-mono text-sm font-semibold text-primary">{p.elo}</span>
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
              <SectionHeading title="So tài gần đây" />
              <ul className="space-y-1.5">
                {(home?.history ?? []).map((h) => (
                  <li
                    key={h.duelId}
                    className="flex items-center gap-2 rounded-xl border bg-card px-2.5 py-1.5 text-sm"
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
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
                    <span className="shrink-0 font-mono text-xs">
                      {h.score}–{h.opponentScore}
                    </span>
                    <span
                      className={cn(
                        "w-9 shrink-0 text-right font-mono text-xs",
                        h.eloDelta >= 0 ? "text-emerald-600" : "text-rose-600",
                      )}
                    >
                      {h.eloDelta >= 0 ? "+" : ""}
                      {h.eloDelta}
                    </span>
                    <Button asChild size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs">
                      <Link to="/dau-truong/xem-lai/$duelId" params={{ duelId: h.duelId }}>
                        Xem lại
                      </Link>
                    </Button>
                  </li>
                ))}
                {!home?.history.length ? (
                  <li className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Chưa có ván so tài nào.
                  </li>
                ) : null}
              </ul>
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </ArenaPage>
  );
}


/** Danh sách đồng nghiệp đang trực tuyến (máy chủ xác nhận qua nhịp tim). */
function OnlineList({
  token,
  players,
  disabled,
}: {
  token: string;
  players: Awaited<ReturnType<typeof arenaPresence>>["online"];
  disabled: boolean;
}) {
  const runInvite = useServerFn(arenaInvite);
  const [sending, setSending] = useState("");

  return (
    <section className="space-y-2">
      <SectionHeading
        title={
          <span className="flex items-center gap-2">
            <Users className="size-4 text-primary" /> Đang trực tuyến ({players.length})
          </span>
        }
      />
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {players.map((p) => (
          <li
            key={p.employeeId}
            className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2"
          >
            <span className="relative">
              <AvatarBubble
                name={p.displayName}
                avatarUrl={p.avatarUrl}
                avatarImage={p.avatarImage}
                level={p.level}
                size="sm"
              />
              <span
                className={cn(
                  "absolute -right-0.5 -top-0.5 size-3 rounded-full ring-2 ring-card",
                  p.busy ? "bg-amber-500" : "bg-emerald-500",
                )}
                title={p.busy ? "Đang bận so tài" : "Sẵn sàng"}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{p.displayName}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {p.title} • Elo {p.elo}
              </span>
            </span>
            <Button
              size="sm"
              variant={p.busy ? "outline" : "default"}
              className="shrink-0 rounded-full"
              disabled={disabled || p.busy || sending === p.employeeId}
              onClick={async () => {
                setSending(p.employeeId);
                try {
                  await runInvite({
                    data: { token, toEmployeeId: p.employeeId, deviceHash: getDeviceId() },
                  });
                  toast.success(`Đã mời ${p.displayName} so tài.`);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Không gửi được lời mời.");
                } finally {
                  setSending("");
                }
              }}
            >
              {sending === p.employeeId ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Swords className="mr-1 size-4" />
              )}
              {p.busy ? "Đang bận" : "So tài"}
            </Button>
          </li>
        ))}
        {!players.length ? (
          <li className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground sm:col-span-2">
            Chưa có đồng nghiệp nào trực tuyến. Hãy dùng “So tài nhanh” để ghép cặp tự động.
          </li>
        ) : null}
      </ul>
    </section>
  );
}


/** Avatar 2D của chính mình trong đấu trường (đồng bộ với nhân vật đã tạo). */
function ArenaSelfAvatar({ profile }: { profile: ArenaProfile }) {
  const { identity } = usePlayerIdentity();
  // Ưu tiên dữ liệu máy chủ (luôn đúng), sau đó tới nhận diện lưu trên máy.
  const avatarUrl = profile.avatarUrl || identity?.avatarUrl || "";
  const avatarImage = profile.avatarImage || identity?.avatarImage || "";
  return (
    <AvatarBubble
      name={profile.displayName}
      avatarUrl={avatarUrl}
      avatarImage={avatarImage}
      level={profile.level || identity?.level}
      size="md"
      live
    />
  );
}

/** Tìm đồng nghiệp theo tên và gửi lời mời thách đấu. */
function ChallengeByName({ token }: { token: string }) {
  const runSearch = useServerFn(arenaSearchOpponents);
  const runInvite = useServerFn(arenaInvite);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof arenaSearchOpponents>>>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRows([]);
      return;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await runSearch({ data: { token, query: term } });
        if (alive) setRows(res);
      } catch {
        if (alive) setRows([]);
      } finally {
        if (alive) setBusy(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, runSearch, token]);

  return (
    <section className="space-y-2">
      <SectionHeading title="Thách đấu theo tên" />
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nhập tên đồng nghiệp…"
          aria-label="Tìm đồng nghiệp để thách đấu"
          className="rounded-xl pl-9"
        />
        {busy ? <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.employeeId} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2">
            <AvatarBubble name={r.fullName} avatarUrl={r.avatarUrl} avatarImage={r.avatarImage} size="sm" level={r.level} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{r.fullName}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {r.unit} • Cấp {r.level} • Elo {r.elo}
              </span>
            </span>
            <Button
              size="sm"
              className="shrink-0 rounded-full"
              onClick={async () => {
                try {
                  await runInvite({ data: { token, toEmployeeId: r.employeeId, deviceHash: getDeviceId() } });
                  toast.success(`Đã gửi lời mời tới ${r.fullName}.`);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Không gửi được lời mời.");
                }
              }}
            >
              <Send className="mr-1 size-4" /> Mời
            </Button>
          </li>
        ))}
        {q.trim().length >= 2 && !busy && rows.length === 0 ? (
          <li className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">
            Không tìm thấy đồng nghiệp phù hợp.
          </li>
        ) : null}
      </ul>
    </section>
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
    <div className="arena-panel arena-radar p-3 sm:p-4">
      {/* Một hàng duy nhất trên điện thoại: tên + 4 chỉ số, không đẩy nội dung xuống dưới. */}
      <div className="relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 sm:flex sm:flex-wrap sm:gap-3">
        <ArenaSelfAvatar profile={profile} />
        <div className="min-w-0 sm:flex-1">
          <p className="truncate text-sm font-semibold sm:text-base">{profile.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{profile.unit}</p>
        </div>
        <div className="col-span-2 grid w-full grid-cols-4 gap-1.5 sm:col-auto sm:w-auto sm:gap-2">
          {items.map((it) => (
            <div key={it.label} className="stat-chip px-1.5 py-1">
              <it.icon className="size-3.5 text-primary" />
              <p className="text-sm font-bold tabular-nums">{it.value}</p>
              <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{it.label}</p>
            </div>
          ))}
        </div>
      </div>
      {profile.badges.length ? (
        <div className="scrollbar-none -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible">
          {profile.badges.map((b) => (
            <span
              key={b.code}
              title={b.name}
              className="shrink-0 rounded-full border bg-background px-2 py-0.5 text-xs"
            >
              {b.icon} {b.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );

}
