import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CalendarClock, ListChecks, ShieldCheck, Timer, Trophy } from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RegisterCard } from "@/components/RegisterCard";
import { ErrorState, PageContainer, StatusPill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, quizStatus } from "@/lib/format";

export const Route = createFileRoute("/cuoc-thi/$quizId")({
  head: () => ({
    meta: [
      { title: "Chi tiết cuộc thi | Hội thi trắc nghiệm trực tuyến" },
      {
        name: "description",
        content: "Thông tin cuộc thi: mô tả, thời gian mở, số câu hỏi, thời lượng làm bài và thể lệ dự thi.",
      },
      { property: "og:title", content: "Chi tiết cuộc thi" },
      { property: "og:description", content: "Mô tả, thời gian, thể lệ và đăng ký dự thi trực tuyến." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuizDetailPage,
  errorComponent: ({ error }) => (
    <PageContainer className="py-16">
      <ErrorState error={error} />
    </PageContainer>
  ),
  notFoundComponent: () => (
    <PageContainer className="py-16">
      <ErrorState title="Không tìm thấy cuộc thi" />
    </PageContainer>
  ),
});

const rules = [
  "Mỗi thí sinh nhận một đề bốc ngẫu nhiên từ ngân hàng câu hỏi, thứ tự phương án được xáo trộn.",
  "Đồng hồ đếm ngược tính theo phiên trên máy chủ; hết giờ hệ thống tự động nộp bài.",
  "Rời khỏi màn hình thi quá 3 lần (chuyển tab, thu nhỏ trình duyệt) sẽ bị huỷ kết quả.",
  "Không sao chép nội dung câu hỏi; chuột phải và sao chép bị vô hiệu hoá trong phòng thi.",
  "Xếp hạng theo điểm số, nếu bằng điểm thì ưu tiên thời gian làm bài ngắn hơn.",
];

function QuizDetailPage() {
  const { quizId } = Route.useParams();

  const quizQuery = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, description, start_time, end_time, is_active, question_count, duration_minutes")
        .eq("id", quizId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const quiz = quizQuery.data;
  const status = quiz ? quizStatus(quiz) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="surface-hero grid-pattern pb-16">
        <SiteHeader variant="onDark" />
        <PageContainer className="pb-8 pt-8 lg:pt-10">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-full text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <Link to="/">
              <ArrowLeft className="size-4" />
              Danh sách cuộc thi
            </Link>
          </Button>
          {quizQuery.isLoading ? (
            <Skeleton className="mt-4 h-12 w-2/3 rounded-2xl" />
          ) : (
            <h1 className="type-h1 mt-4">{quiz?.title ?? "Không tìm thấy cuộc thi"}</h1>
          )}
          {status && (
            <div className="mt-3">
              <StatusPill status={status} className="bg-primary-foreground/15 text-primary-foreground" />
            </div>
          )}
        </PageContainer>
      </div>

      <main className="sheet-panel">
        <PageContainer className="pb-14 pt-8">
          {quizQuery.isError ? (
            <ErrorState
              error={quizQuery.error}
              onRetry={() => void quizQuery.refetch()}
              retrying={quizQuery.isFetching}
            />
          ) : quizQuery.isLoading ? (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
              <Skeleton className="h-80 rounded-3xl" />
              <Skeleton className="h-80 rounded-3xl" />
            </div>
          ) : !quiz ? (
            <ErrorState title="Không tìm thấy cuộc thi" />
          ) : (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
              <div className="space-y-6">
                <section className="card-elevated p-6">
                  <h2 className="type-h2">Giới thiệu</h2>
                  <p className="type-lead mt-3 whitespace-pre-line text-muted-foreground">
                    {quiz.description?.trim() || "Cuộc thi trắc nghiệm trực tuyến dành cho cán bộ, nhân viên đơn vị."}
                  </p>
                </section>

                <section className="grid gap-3 sm:grid-cols-3">
                  {[
                    { icon: ListChecks, label: "Số câu hỏi", value: `${quiz.question_count} câu` },
                    { icon: Timer, label: "Thời lượng", value: `${quiz.duration_minutes} phút` },
                    { icon: ShieldCheck, label: "Hình thức", value: "Trắc nghiệm 4 đáp án" },
                  ].map((s) => (
                    <div key={s.label} className="card-elevated p-4">
                      <s.icon className="size-5 text-accent" />
                      <p className="type-meta mt-2">{s.label}</p>
                      <p className="font-heading text-lg font-bold">{s.value}</p>
                    </div>
                  ))}
                </section>

                <section className="card-elevated p-6">
                  <h2 className="type-h2">Thời gian diễn ra</h2>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      { label: "Mở đăng ký từ", value: formatDateTime(quiz.start_time) },
                      { label: "Kết thúc", value: formatDateTime(quiz.end_time) },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-3 rounded-2xl bg-secondary p-4">
                        <CalendarClock className="size-5 shrink-0 text-accent" />
                        <div className="min-w-0">
                          <dt className="type-meta">{row.label}</dt>
                          <dd className="truncate font-semibold">{row.value}</dd>
                        </div>
                      </div>
                    ))}
                  </dl>
                </section>

                <section className="card-elevated p-6">
                  <h2 className="type-h2">Thể lệ dự thi</h2>
                  <ul className="mt-4 space-y-3">
                    {rules.map((rule) => (
                      <li key={rule} className="flex gap-3 text-sm leading-relaxed">
                        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <div className="space-y-4 lg:sticky lg:top-24">
                {status !== "open" && (
                  <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                    <span>
                      Cuộc thi hiện{" "}
                      {status === "upcoming" ? "chưa đến giờ mở" : status === "closed" ? "đã kết thúc" : "đang tạm dừng"}
                      . Bạn chưa thể vào phòng thi.
                    </span>
                  </div>
                )}
                <RegisterCard quizzes={[quiz]} lockedQuizId={quiz.id} />
                <Button asChild variant="outline" className="w-full rounded-full">
                  <Link to="/bang-xep-hang">
                    <Trophy className="size-4" />
                    Xem bảng xếp hạng
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </PageContainer>
        <SiteFooter />
      </main>
    </div>
  );
}
