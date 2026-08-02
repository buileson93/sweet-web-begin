import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, BookOpen, CalendarPlus, Plane, Timer, Trophy } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { CountdownBadge } from "@/components/CountdownBadge";
import { Podium } from "@/components/Podium";
import { SnapCarousel } from "@/components/SnapCarousel";
import { ProductTour, type TourStep } from "@/components/ProductTour";
import { RegisterCard } from "@/components/RegisterCard";
import { EmptyState, ListSkeleton, QueryState, SectionHeading, StatusPill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, quizStatus } from "@/lib/format";
import { resolveQuizCover } from "@/lib/quizCover";
import { PlayerHeroCard } from "@/components/player/PlayerHeroCard";
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
  const [heroOpen, setHeroOpen] = useState(false);
  // Danh sách cuộc thi tải dần để trang chủ không phải cuộn quá dài
  const [visibleQuizzes, setVisibleQuizzes] = useState(4);

  const quizzesQuery = useQuery({
    queryKey: ["quizzes", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, description, start_time, end_time, is_active, question_count, duration_minutes, intro_markdown, cover_url, cover_fit, peek_rewards, pass_percent")
        .neq("status", "draft")
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

  // Ưu tiên cuộc thi sắp diễn ra lên đầu, rồi đang mở, tạm dừng, đã kết thúc
  const STATUS_RANK: Record<string, number> = { upcoming: 0, open: 1, paused: 2, closed: 3 };
  const quizzes = [...(quizzesQuery.data ?? [])].sort((a, b) => {
    const ra = STATUS_RANK[quizStatus(a)] ?? 9;
    const rb = STATUS_RANK[quizStatus(b)] ?? 9;
    if (ra !== rb) return ra - rb;
    const ta = a.start_time ? new Date(a.start_time).getTime() : 0;
    const tb = b.start_time ? new Date(b.start_time).getTime() : 0;
    return ta - tb;
  });
  const openCount = quizzes.filter((q) => quizStatus(q) === "open").length;

  return (
    <AppShell>
      <ProductTour steps={TOUR_STEPS} />

      {/* Bố cục chia đôi: trái = vào phòng thi, phải = bảng xếp hạng trực tiếp */}
      <section className="grid gap-5 lg:grid-cols-12 lg:items-start lg:gap-8 xl:gap-10">
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5 lg:col-span-7">

          <div className="animate-pop relative min-w-0">
            {/* Máy bay bay vòng quanh cuốn sách tri thức — thu nhỏ dần trên màn hình thấp */}
            <div
              className="pointer-events-none absolute -top-1 right-0 grid size-14 place-items-center sm:size-24 lg:-right-2 lg:size-20"
              aria-hidden
            >
              <span className="plane-orbit">
                <span className="plane-orbit-ring">
                  <span className="plane-orbit-craft">
                    <Plane className="size-3.5 text-accent drop-shadow-sm sm:size-5" strokeWidth={2.2} />
                  </span>
                </span>
              </span>
              <BookOpen className="animate-book-flip relative size-6 text-primary/70 drop-shadow-sm sm:size-9" />
            </div>

            {/* Tiêu đề gọn trên một hàng, bấm để mở bảng giới thiệu đầy đủ */}
            <button
              type="button"
              onClick={() => setHeroOpen(true)}
              className="block w-full text-left"
              aria-label="Xem giới thiệu Đấu trường tri thức VATM"
            >
              <h1 className="hero-title font-heading group cursor-pointer whitespace-nowrap text-[clamp(1rem,4.4vw,2.6rem)] font-extrabold uppercase leading-tight tracking-tight [hyphens:none] lg:whitespace-normal lg:text-balance lg:pr-24 lg:text-[clamp(1.6rem,2.35vw,2.5rem)]">
                <span className="hero-line">Chinh phục bầu trời </span>
                <span className="hero-line hero-line-accent">
                  kiến thức
                  <span className="hero-underline" aria-hidden />
                </span>
              </h1>
            </button>

          </div>


          <PlayerHeroCard className="animate-pop" />

          <div data-tour="register" className="animate-pop" style={{ animationDelay: "0.1s" }}>
            <RegisterCard quizzes={quizzes} loading={quizzesQuery.isLoading} value={quizId} onValueChange={setQuizId} />
          </div>
        </div>

        <div data-tour="leaderboard" className="flex min-w-0 flex-col gap-3 sm:gap-4 lg:col-span-5">
          <div
            className="panel-pastel animate-pop relative overflow-hidden rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-6"
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

            {/* Trên điện thoại bục vinh danh đã đủ thông tin — danh sách chi tiết chỉ hiện từ sm trở lên */}
            <div className="relative mt-6 hidden space-y-2 sm:block">

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
              className="relative mt-4 flex items-center justify-center gap-2 rounded-2xl bg-secondary py-2.5 text-xs font-bold uppercase tracking-widest text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground sm:mt-5 sm:py-3"
            >
              Xem toàn bộ xếp hạng <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="stagger grid grid-cols-2 gap-3 sm:gap-4">
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
      <section id="cuoc-thi" data-tour="quizzes" className="mt-7 scroll-mt-24 sm:mt-10">
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
            <SnapCarousel
              className="stagger"
              label="Danh sách cuộc thi"
              gridClassName="md:grid-cols-1 md:auto-rows-[7.5rem] lg:auto-rows-[8rem]"
            >
              {quizzes.slice(0, visibleQuizzes).map((q) => {
                const st = quizStatus(q);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => navigate({ to: "/cuoc-thi/$quizId", params: { quizId: q.id } })}
                    className={cn(
                      "game-card quiz-card group relative flex min-w-0 flex-col overflow-hidden p-4 text-left sm:p-5 md:h-full md:w-auto w-full md:flex-row md:items-center md:gap-6 md:px-6",
                      st === "closed" && "opacity-70",
                    )}
                  >
                    {/* Ảnh ngang chủ đề: trượt ra từ mép phải khi rê chuột, luôn nằm dưới lớp chữ */}
                    <img
                      src={resolveQuizCover(q.cover_url, q.id, q.title)}
                      alt=""
                      aria-hidden
                      loading="lazy"
                      decoding="async"
                      width={1536}
                      height={640}
                      data-ready="0"
                      onLoad={(e) => e.currentTarget.setAttribute("data-ready", "1")}
                      className={cn(
                        "quiz-card-art pointer-events-none absolute inset-y-0 right-0 h-full w-[62%] max-w-none select-none bg-secondary/30 object-right sm:w-[68%] md:w-[34%]",
                        q.cover_fit === "cover" ? "object-cover" : "object-contain",
                      )}
                    />
                    <span className="quiz-card-scrim" aria-hidden />

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
                    <span className="relative flex items-start justify-between gap-3 md:w-32 md:shrink-0 md:flex-col md:items-start md:gap-2">
                      <StatusPill status={st} className={st === "open" ? "animate-glow" : undefined} />
                      <span className="type-meta inline-flex items-center gap-1 font-bold">
                        <Timer className="size-3.5" />
                        {q.duration_minutes}′
                      </span>
                    </span>
                    <h3 className="type-h3 relative mt-3 line-clamp-2 break-words text-pretty pr-1 transition-colors group-hover:text-primary md:mt-0 md:min-w-0 md:flex-1">
                      {q.title}
                    </h3>
                    <span className="relative mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 md:mt-0 md:w-auto md:shrink-0 md:justify-end md:gap-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                      <span className="min-w-0 md:text-right">
                        <span className="type-meta block truncate md:whitespace-nowrap">
                          {q.question_count} câu • {formatDateTime(q.start_time)}
                        </span>

                        {st === "upcoming" && <CountdownBadge target={q.start_time} className="mt-1.5" />}
                      </span>
                      <span className="grid size-9 place-items-center rounded-xl bg-secondary text-primary transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                        <ArrowRight className="size-4" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </SnapCarousel>

            {quizzes.length > visibleQuizzes && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  className="rounded-full font-semibold"
                  onClick={() => setVisibleQuizzes((n) => n + 4)}
                >
                  Xem thêm cuộc thi ({quizzes.length - visibleQuizzes})
                </Button>
              </div>
            )}
          </QueryState>
        </div>
      </section>

      {/* Giới thiệu đầy đủ nằm trong bảng trượt để không chiếm chiều cao trang chủ */}
      <Sheet open={heroOpen} onOpenChange={setHeroOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="text-left">
            <SheetTitle>Đấu trường tri thức VATM</SheetTitle>
            <SheetDescription>
              Sân chơi kiến thức nội bộ của Công ty Quản lý bay miền Trung: thi thử không giới hạn, chấm điểm tức thì,
              tích luỹ điểm kinh nghiệm và leo bảng xếp hạng cùng đồng nghiệp.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex flex-wrap gap-2 pb-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/huong-dan">Luật chơi</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/dau-truong">Đấu trường</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/bang-xep-hang">Bảng xếp hạng</Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
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
    <div className="card-elevated p-3 sm:p-4">
      <span className="type-eyebrow flex items-center gap-1.5 text-muted-foreground">
        {icon} {label}
      </span>
      <span
        className={cn(
          "font-heading mt-0.5 block text-xl font-extrabold tabular-nums sm:mt-1 sm:text-2xl",
          tone === "accent" ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>

  );
}
