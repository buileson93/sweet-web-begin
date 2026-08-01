import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  History,
  Loader2,
  ShieldCheck,
  Sparkles,
  Timer,
  UserRoundCog,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { usePlayerIdentity } from "@/hooks/usePlayerIdentity";

import { Avatar2D } from "@/components/player/Avatar2D";
import { AvatarBubble, type AvatarBubbleSize } from "@/components/player/AvatarBubble";
import { AvatarPickerDialog } from "@/components/player/AvatarPickerDialog";
import { LevelBar } from "@/components/player/LevelBar";
import { LevelLadder } from "@/components/player/LevelLadder";
import { EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyEmployeeFn } from "@/lib/employees.functions";
import { getExamHistory } from "@/lib/exam.functions";
import type { ExamHistory } from "@/lib/exam.server";
import { formatDateTime, formatSeconds } from "@/lib/format";
import { getPlayerProfile, type PlayerProfile } from "@/lib/player.functions";
import { readQuickLogin, saveQuickLogin } from "@/lib/quickLogin";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/nhan-vat")({
  head: () => ({
    meta: [
      { title: "Nhân vật của tôi | Đấu trường tri thức VATM" },
      {
        name: "description",
        content:
          "Chăm chút nhân vật, xem cấp độ, kinh nghiệm và toàn bộ lịch sử làm bài của bạn tại hội thi trắc nghiệm nội bộ.",
      },
      { property: "og:title", content: "Nhân vật của tôi" },
      { property: "og:description", content: "Tuỳ chỉnh nhân vật, theo dõi cấp độ và lịch sử làm bài." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CharacterPage,
});

function credentialOk(value: string) {
  const v = value.trim();
  return /^\d{4}$/.test(v) || /^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}$/.test(v) || /^\d{8}$/.test(v);
}

const SIZE_DEMO: { size: AvatarBubbleSize; label: string }[] = [
  { size: "xs", label: "Siêu nhỏ" },
  { size: "sm", label: "Nhỏ" },
  { size: "md", label: "Vừa" },
  { size: "lg", label: "Lớn" },
];

function CharacterPage() {
  const runVerify = useServerFn(verifyEmployeeFn);
  const runProfile = useServerFn(getPlayerProfile);
  const runHistory = useServerFn(getExamHistory);
  const { save: savePlayer } = usePlayerIdentity();

  const [name, setName] = useState("");
  const [credential, setCredential] = useState("");

  // Ghi nhớ đăng nhập nhanh trong 3 giờ.
  useEffect(() => {
    const quick = readQuickLogin();
    if (!quick) return;
    setName((prev) => prev || quick.name);
    setCredential((prev) => prev || quick.credential);
  }, []);

  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [history, setHistory] = useState<ExamHistory | null>(null);

  const canSubmit = name.trim().length >= 3 && credentialOk(credential);

  async function handleEnter() {
    if (!canSubmit) return toast.error("Nhập họ tên và 4 số cuối điện thoại hoặc ngày sinh.");
    setLoading(true);
    try {
      const employee = await runVerify({ data: { name: name.trim(), credential: credential.trim() } });
      if (!employee?.id) throw new Error("Không tìm thấy bạn trong danh bạ nhân viên.");
      const [p, h] = await Promise.all([
        runProfile({ data: { employeeId: employee.id } }),
        runHistory({ data: { name: name.trim(), credential: credential.trim() } }),
      ]);
      const merged = { ...p, displayName: p.displayName || employee.fullName || name.trim() };
      setProfile(merged);
      saveQuickLogin({ name: name.trim(), credential: credential.trim() });
      setHistory(h);
      savePlayer(merged);
    } catch (error) {
      setProfile(null);
      setHistory(null);
      toast.error(error instanceof Error ? error.message : "Không mở được hồ sơ nhân vật.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <header className="surface-hero relative overflow-hidden rounded-2xl px-5 py-6 sm:px-7">
        <Sparkles aria-hidden className="animate-float pointer-events-none absolute -right-4 -top-4 size-32 text-primary-foreground/10" />
        <h1 className="type-h2 text-primary-foreground">Nhân vật của tôi</h1>
        <p className="type-muted mt-1 max-w-xl text-primary-foreground/80">
          Chăm chút nhân vật, theo dõi cấp độ kinh nghiệm và xem lại toàn bộ lịch sử làm bài.
        </p>
      </header>

      <section className="card-elevated mt-5 rounded-2xl p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Họ và tên</Label>
            <Input
              id="c-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nguyễn Văn A"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-cred">4 số cuối điện thoại / ngày sinh</Label>
            <Input
              id="c-cred"
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              placeholder="1234 hoặc 01/01/1990"
              className="rounded-xl"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) void handleEnter();
              }}
            />
          </div>
          <Button className="h-10 rounded-xl" disabled={loading || !canSubmit} onClick={() => void handleEnter()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {loading ? "Đang mở hồ sơ..." : "Mở hồ sơ"}
          </Button>
        </div>
      </section>

      {profile ? (
        <>
          <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <div className="card-elevated flex flex-col items-center gap-3 rounded-2xl p-5">
              {/* Khung nhân vật vừa mắt trên điện thoại, không chiếm hết màn hình */}
              <div className="grid h-32 w-full place-items-center rounded-2xl bg-gradient-to-b from-secondary/70 to-background p-3 sm:h-40">
                <Avatar2D
                  value={profile.avatarUrl}
                  name={profile.displayName}
                  className="h-full w-auto max-w-full"
                />
              </div>

              <AvatarBubble
                name={profile.displayName}
                avatarUrl={profile.avatarUrl}
                avatarImage={profile.avatarImage}
                size="md"
                live
              />
              <div className="text-center">
                <p className="font-heading inline-flex items-center gap-1.5 text-base font-extrabold">
                  <BadgeCheck className="size-4 text-success" /> {profile.displayName}
                </p>
                <p className="type-meta">{profile.unit || "Chưa rõ đơn vị"}</p>
              </div>
              <AvatarPickerDialog
                name={name.trim()}
                credential={credential.trim()}
                currentUrl={profile.avatarUrl}
                onSaved={(next) => setProfile(next)}
              />
              <div className="mt-2 w-full rounded-xl border border-border bg-secondary/50 p-3">
                <p className="type-meta mb-2 inline-flex items-center gap-1.5">
                  <UserRoundCog className="size-3.5" /> Các cỡ hiển thị của nhân vật
                </p>
                <div className="flex items-end justify-around gap-2">
                  {SIZE_DEMO.map((s) => (
                    <span key={s.size} className="flex flex-col items-center gap-1">
                      <AvatarBubble
                        name={profile.displayName}
                        avatarImage={profile.avatarImage}
                        size={s.size}
                      />
                      <span className="type-meta">{s.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <LevelBar
                data={{
                  level: profile.level,
                  title: profile.title,
                  into: profile.into,
                  need: profile.need,
                  percent: profile.percent,
                }}
              />
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Lượt thi", value: profile.examsTaken },
                  { label: "Lượt đạt", value: profile.examsPassed },
                  { label: "Chuỗi dài nhất", value: profile.bestStreak },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-border bg-card p-3 text-center">
                    <p className="font-heading text-xl font-extrabold text-primary">{s.value}</p>
                    <p className="type-meta">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-5">
            <h2 className="font-heading mb-3 inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-tight">
              <Sparkles className="size-4 text-primary" /> 10 cấp bậc &amp; phần thưởng
            </h2>
            <LevelLadder level={profile.level} />
          </section>

          <section className="mt-5">
            <h2 className="font-heading mb-3 inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-tight">
              <History className="size-4 text-primary" /> Lịch sử làm bài
            </h2>
            {history && history.attempts.length > 0 ? (
              <ul className="space-y-2">
                {history.attempts.map((a) => (
                  <li
                    key={a.sessionId}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3"
                  >
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-xl",
                        a.passed ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {a.passed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{a.quizTitle}</span>
                      <span className="type-meta inline-flex flex-wrap items-center gap-x-3">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="size-3.5" /> {formatDateTime(a.startedAt)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Timer className="size-3.5" /> {formatSeconds(a.timeSeconds)}
                        </span>
                      </span>
                    </span>
                    <span className="font-heading shrink-0 text-sm font-extrabold">
                      {a.score}/{a.total} · {a.percent}%
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={History}
                title="Chưa có lượt thi nào"
                description="Hãy tham gia một cuộc thi để bắt đầu tích luỹ kinh nghiệm cho nhân vật của bạn."
              />
            )}
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
