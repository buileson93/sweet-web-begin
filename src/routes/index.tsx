import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, BookOpen, CalendarPlus, Plane, Timer, Trophy } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Podium } from "@/components/Podium";
import { ProductTour, type TourStep } from "@/components/ProductTour";
import { RegisterCard } from "@/components/RegisterCard";
import { EmptyState, ListSkeleton, QueryState, SectionHeading, StatusPill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, quizStatus } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Đấu trường tri thức VATM | Thi trắc nghiệm trực tuyến" },
      {
        name: "description",
        content:
          "Đấu trường tri thức trực tuyến của Công ty Quản lý bay miền Trung: chọn cuộc thi, làm bài tính giờ, chấm điểm tức thì và leo bảng xếp hạng.",
      },
      { property: "og:title", content: "Đấu trường tri thức VATM | Thi trắc nghiệm trực tuyến" },
      {
        property: "og:description",
        content: "Đấu trường tri thức trực tuyến của Công ty Quản lý bay miền Trung: chọn cuộc thi, làm bài tính giờ, chấm điểm tức thì và leo bảng xếp hạng.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const TOUR_STEPS: TourStep[] = [
  {
    target: "register",
    title: "Đăng nhập nhanh để dự thi",
    description: "Nhập đúng họ tên và 4 số cuối điện thoại đã đăng ký với công ty để hệ thống ghi nhận kết quả.",
  },
  {
    target: "quizzes",
    title: "Chọn cuộc thi phù hợp",
    description: "Mỗi thẻ hiển thị trạng thái và thời lượng. Bấm vào để xem luật chơi chi tiết trước khi bắt đầu.",
  },
  {
    target: "leaderboard",
    title: "Theo dõi bảng xếp hạng",
    description: "Kết quả cập nhật theo thời gian thực. Đạt từ 50% số điểm mới được ghi nhận chính thức.",
  },
];

function HomePage() {
  const navigate = useNavigate();
  const [quizId, setQuizId] = useState("");

  const quizzesQuery = useQuery({
    queryKey: ["quizzes", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, description, start_time, end_time, is_active, question_count, duration_minutes, intro_markdown")
        .eq("status", "published")
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Bảng xếp hạng lọc theo từng kỳ thi ("all" = tổng hợp mọi kỳ thi)
  const [boardQuiz, setBoardQuiz] = useState<string>("all");

  const topQuery = useQuery({
    queryKey: ["results", "top3", boardQuiz],
    queryFn: async () => {
      let q = supabase
        .from("results")
        .select("id, candidate_name, unit, score, total, time_seconds")
        .eq("disqualified", false);
      if (boardQuiz !== "all") q = q.eq("quiz_id", boardQuiz);
      const { data, error } = await q
        .order("score", { ascending: false })
        .order("time_seconds", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });


  const countQuery = useQuery({
    queryKey: ["results", "count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("results")
        .select("id", { count: "exact", head: true })
        .eq("disqualified", false);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const quizzes = quizzesQuery.data ?? [];
  const openCount = quizzes.filter((q) => quizStatus(q) === "open").length;

  return (
    <AppShell>
      <ProductTour steps={TOUR_STEPS} />

      {/* Bố cục chia đôi: trái = vào phòng thi, phải = bảng xếp hạng trực tiếp */}
      <section className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-7">
          <div className="animate-pop relative min-w-0">
...
            <h1 className="type-h1 mt-3 max-w-[20ch] text-pretty uppercase [hyphens:none] sm:pr-28">
              <span className="block sm:whitespace-nowrap">Chinh phục bầu trời</span>
              <span className="block text-primary sm:whitespace-nowrap">kiến thức</span>
            </h1>

            <p className="type-lead mt-2 max-w-xl text-balance text-muted-foreground">
              Thi thử không giới hạn — mỗi lượt là một lần vững kiến thức hơn.
            </p>
          </div>

          <div data-tour="register" className="animate-pop" style={{ animationDelay: "0.1s" }}>
            <RegisterCard quizzes={quizzes} loading={quizzesQuery.isLoading} value={quizId} onValueChange={setQuizId} />
          </div>
        </div>

        <div data-tour="leaderboard" className="flex min-w-0 flex-col gap-4 lg:col-span-5">
          <div
            className="panel-pastel animate-pop relative overflow-hidden rounded-[2rem] p-6"
            style={{ animationDelay: "0.16s" }}
          >
            <div className="relative flex items-end justify-between gap-3">
              <h2 className="font-heading text-lg font-extrabold uppercase tracking-tight">Bảng xếp hạng</h2>
              <span className="type-meta inline-flex items-center gap-1.5 font-bold text-primary">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Trực tiếp
              </span>
            </div>

            {/* Lọc bảng xếp hạng theo từng kỳ thi */}
            <div className="relative mt-3">
              <Select value={boardQuiz} onValueChange={setBoardQuiz}>
                <SelectTrigger className="h-9 w-full rounded-full border-border bg-card/80 text-xs font-bold">
                  <SelectValue placeholder="Chọn kỳ thi" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  avoidCollisions
                  collisionPadding={12}
                  className="z-[60] max-h-72 w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)]"
                >
                  <SelectItem value="all">Tất cả kỳ thi</SelectItem>
                  {quizzes.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {topQuery.isLoading ? (
              <div className="relative mt-6 flex items-end justify-center gap-2">
                <Skeleton className="h-20 w-full rounded-t-2xl" />
                <Skeleton className="h-32 w-full rounded-t-2xl" />
                <Skeleton className="h-16 w-full rounded-t-2xl" />
              </div>
            ) : (
              <Podium className="relative" rows={topQuery.data ?? []} />
            )}

            <div className="relative mt-6 space-y-2">
              {(topQuery.data ?? []).slice(0, 3).map((r, i) => (
                <div
                  key={r.id}
                  className={cn(
                    "rank-row group flex items-center justify-between gap-3 rounded-2xl border px-4 py-2.5",
                    i === 0
                      ? "rank-sheen border-gold/50 bg-[oklch(0.97_0.05_92)] hover:bg-[oklch(0.95_0.08_92)]"
                      : "border-border bg-card/70 hover:bg-secondary",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "font-heading text-xs font-extrabold",
                        i === 0 ? "text-gold-foreground" : "text-muted-foreground",
                      )}
                    >
                      0{i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{r.candidate_name}</span>
                      <span className="type-meta block truncate">{r.unit ?? "Chưa rõ đơn vị"}</span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      "font-heading shrink-0 text-sm font-extrabold transition-transform duration-300 group-hover:scale-110",
                      i === 0 ? "text-gold-foreground" : "text-primary",
                    )}
                  >
                    {r.score}/{r.total}
                  </span>
                </div>
              ))}
            </div>

            <Link
              to="/bang-xep-hang"
              className="relative mt-5 flex items-center justify-center gap-2 rounded-2xl bg-secondary py-3 text-xs font-bold uppercase tracking-widest text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              Xem toàn bộ xếp hạng <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="stagger grid grid-cols-2 gap-4">
            <StatTile label="Lượt thi" value={countQuery.isLoading ? "…" : String(countQuery.data ?? 0)} />
            <StatTile
              label="Đang mở"
              value={`${openCount}/${quizzes.length}`}
              tone="accent"
              icon={<Trophy className="size-4" />}
            />
          </div>
        </div>
      </section>

      {/* Danh sách cuộc thi */}
      <section data-tour="quizzes" className="mt-10">
        <SectionHeading
          title="Danh sách cuộc thi"
          action={
            <Button asChild variant="ghost" className="rounded-full font-semibold text-primary hover:bg-secondary">
              <Link to="/huong-dan">Luật chơi</Link>
            </Button>
          }
        />

        <div className="mt-5">
          <QueryState
            isLoading={quizzesQuery.isLoading}
            isError={quizzesQuery.isError}
            error={quizzesQuery.error}
            isFetching={quizzesQuery.isFetching}
            onRetry={() => void quizzesQuery.refetch()}
            isEmpty={quizzes.length === 0}
            skeleton={<ListSkeleton rows={3} height="h-40" />}
            empty={
              <EmptyState
                icon={CalendarPlus}
                title="Chưa có cuộc thi nào"
                description="Quản trị viên chưa tạo cuộc thi. Vui lòng quay lại sau."
                action={
                  <Button asChild variant="outline" className="rounded-full">
                    <Link to="/huong-dan">Xem hướng dẫn</Link>
                  </Button>
                }
              />
            }
          >
            <div className="stagger grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {quizzes.map((q) => {
                const st = quizStatus(q);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => navigate({ to: "/cuoc-thi/$quizId", params: { quizId: q.id } })}
                    className={cn(
                      "game-card group relative overflow-hidden p-5 text-left",
                      st === "closed" && "opacity-70",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute -right-16 -top-16 size-32 rounded-full transition-transform duration-500 group-hover:scale-125",
                        st === "open"
                          ? "bg-success/10"
                          : st === "upcoming"
                            ? "bg-gold/20"
                            : st === "paused"
                              ? "bg-destructive/10"
                              : "bg-muted",
                      )}
                    />
                    <span className="relative flex items-start justify-between gap-3">
                      <StatusPill status={st} className={st === "open" ? "animate-glow" : undefined} />
                      <span className="type-meta inline-flex items-center gap-1 font-bold">
                        <Timer className="size-3.5" />
                        {q.duration_minutes}′
                      </span>
                    </span>
                    <h3 className="type-h3 relative mt-3 line-clamp-2 transition-colors group-hover:text-primary">
                      {q.title}
                    </h3>
                    <span className="relative mt-4 flex items-center justify-between border-t border-border pt-3">
                      <span className="type-meta">
                        {q.question_count} câu • {formatDateTime(q.start_time)}
                      </span>
                      <span className="grid size-9 place-items-center rounded-xl bg-secondary text-primary transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                        <ArrowRight className="size-4" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </QueryState>
        </div>
      </section>
    </AppShell>
  );
}

function StatTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone?: "accent";
  icon?: React.ReactNode;
}) {
  return (
    <div className="card-elevated p-4">
      <span className="type-eyebrow flex items-center gap-1.5 text-muted-foreground">
        {icon} {label}
      </span>
      <span
        className={cn(
          "font-heading mt-1 block text-2xl font-extrabold tabular-nums",
          tone === "accent" ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
