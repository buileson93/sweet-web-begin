import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Medal, Radio, RotateCcw, Search, SearchX, Trophy } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { AwardsBoard } from "@/components/AwardsBoard";

import { LevelBoard } from "@/components/player/LevelBoard";
import { MobileFold } from "@/components/MobileFold";


import { EmptyState, ListSkeleton, QueryState } from "@/components/ui-kit";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeResults } from "@/hooks/useRealtimeResults";
import { downloadCsv, downloadExcel, type ExportRow } from "@/lib/export";
import { formatDateTime, formatSeconds } from "@/lib/format";
import { rankUniqueResults } from "@/lib/leaderboard";
import { getRankableResults } from "@/lib/leaderboard.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bang-xep-hang")({
  head: () => ({
    meta: [
      { title: "Bảng xếp hạng thí sinh | Hội thi trắc nghiệm" },
      {
        name: "description",
        content: "Bảng xếp hạng kết quả thi trắc nghiệm theo điểm số và thời gian làm bài của từng thí sinh.",
      },
      { property: "og:title", content: "Bảng xếp hạng thí sinh" },
      { property: "og:description", content: "Xếp hạng theo điểm số và thời gian làm bài của các thí sinh." },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const [quizId, setQuizId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const fetchResults = useServerFn(getRankableResults);

  const quizzesQuery = useQuery({
    queryKey: ["quizzes", "titles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quizzes").select("id, title, is_featured").order("start_time");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (quizId === null && quizzesQuery.data) {
      const featured = quizzesQuery.data.find(q => q.is_featured);
      setQuizId(featured ? featured.id : "all");
    }
  }, [quizzesQuery.data, quizId]);

  const activeQuizId = quizId || "all";

  const resultsQuery = useQuery({
    queryKey: ["results", activeQuizId],
    queryFn: () => fetchResults({ data: { quizId: activeQuizId as any, limit: 5000 } }),
    enabled: quizId !== null,
  });

  const { live, pendingUpdates } = useRealtimeResults({
    queryKey: ["results", activeQuizId],
    quizId: activeQuizId === "all" ? null : activeQuizId,
  });

  const all = resultsQuery.data || [];
  const rows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    // rankUniqueResults: loại bài dưới 50%, sắp xếp công bằng, mỗi thí sinh chỉ giữ bài tốt nhất.
    const ranked = rankUniqueResults(all as any[]) as any[];
    if (!kw) return ranked;
    return ranked.filter(
      (r: any) => (r.candidate_name || "").toLowerCase().includes(kw) || (r.unit ?? "").toLowerCase().includes(kw),
    );
  }, [all, keyword]);

  // Vinh danh tính trên toàn bộ kết quả của kỳ thi đang chọn (không lọc theo từ khoá).
  const awardRows = useMemo(
    () =>
      all.map((r) => ({
        id: r.id,
        candidate_name: r.candidate_name,
        unit: r.unit,
        score: r.score,
        total: r.total,
        time_seconds: r.time_seconds,
        points: r.points ?? 0,
        best_streak: r.best_streak ?? 0,
        submitted_at: r.submitted_at,
      })),
    [all],
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page]);

  useEffect(() => {
    setPage(1);
  }, [quizId, keyword]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const quizLabel =
    activeQuizId === "all" ? "tat-ca" : ((quizzesQuery.data ?? []).find((q) => q.id === activeQuizId)?.title ?? "cuoc-thi");

  function exportRows(): ExportRow[] {
    return rows.map((r: any, i) => ({
      "Xếp hạng": i + 1,
      "Họ và tên": r.candidate_name || "Không rõ",
      "Đơn vị": r.unit ?? "",
      "Cuộc thi": r.quiz_title ?? "",
      "Điểm số": r.points ?? 0,
      "Số câu đúng": `${r.score}/${r.total}`,
      "Chuỗi dài nhất": r.best_streak ?? 0,
      "Số lượt thi": r.attempts ?? 1,
      "Thời gian làm bài": formatSeconds(r.time_seconds),
      "Thời điểm nộp": formatDateTime(r.submitted_at),
    }));
  }

  function fileName(ext: string) {
    const slug = quizLabel
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
    return `bang-xep-hang-${slug}-${new Date().toISOString().slice(0, 10)}.${ext}`;
  }

  async function handleExport(kind: "csv" | "xlsx") {
    if (rows.length === 0) return toast.error("Không có dữ liệu để tải xuống.");
    try {
      if (kind === "csv") downloadCsv(exportRows(), fileName("csv"));
      else await downloadExcel(exportRows(), fileName("xlsx"), "Bang xep hang");
      toast.success(`Đã tải xuống ${rows.length} kết quả.`);
    } catch {
      toast.error("Không thể tạo tệp tải xuống.");
    }
  }

  return (
    <AppShell>
      <div className="surface-hero animate-pop relative overflow-hidden rounded-2xl px-4 py-4 sm:px-7 sm:py-5">
        <Trophy aria-hidden className="animate-float absolute -right-4 -top-4 size-20 text-primary-foreground/10 sm:size-28" />
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl surface-gold shadow-[var(--shadow-gold)] sm:size-11">
            <Trophy className="size-4.5 sm:size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="type-h2 text-primary-foreground">Bảng xếp hạng</h1>
            <p className="type-meta line-clamp-2 text-primary-foreground/75 sm:line-clamp-none whitespace-pre-line">
              Hệ thống đã lên kế hoạch và tinh chỉnh cơ chế chống script để bảo vệ thí sinh, tránh các trường hợp báo cáo lỗi script "bị oan" do kết nối mạng hoặc thiết bị. Dữ liệu tham gia được đồng bộ minh bạch trên toàn hệ thống.
            </p>
          </div>
        </div>
      </div>

      <MobileFold
        className="mt-4 sm:mt-5"
        title="Vinh danh các hạng mục"
        hint="Chạm để xem giải thưởng, quán quân và cấp bậc"
      >
        <AwardsBoard className="mt-3" rows={awardRows} />
        
        <LevelBoard className="mt-3" />
      </MobileFold>

      <div className="mt-4 sm:mt-5">
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <div className="flex gap-2">
              <Select value={activeQuizId} onValueChange={setQuizId}>
                <SelectTrigger className="min-w-0 flex-1 rounded-xl sm:max-w-[16rem]">
                  <SelectValue placeholder="Tất cả cuộc thi" />
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-1.5rem)]">
                  <SelectItem value="all">Tất cả cuộc thi</SelectItem>
                  {(quizzesQuery.data ?? []).map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Trên điện thoại hai nút tải xuống thu về dạng biểu tượng để không chiếm cả một hàng */}
              <div className="flex shrink-0 gap-2 sm:hidden">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  aria-label="Tải xuống CSV"
                  disabled={rows.length === 0}
                  onClick={() => void handleExport("csv")}
                >
                  <Download className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  aria-label="Tải xuống Excel"
                  disabled={rows.length === 0}
                  onClick={() => void handleExport("xlsx")}
                >
                  <FileSpreadsheet className="size-4" />
                </Button>
              </div>
            </div>

            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm theo tên hoặc đơn vị..."
                className="rounded-full pl-10"
              />
            </div>
            <div className="hidden gap-2 sm:flex">
              <Button
                variant="outline"
                className="rounded-full"
                disabled={rows.length === 0}
                onClick={() => void handleExport("csv")}
              >
                <Download className="size-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                className="rounded-full"
                disabled={rows.length === 0}
                onClick={() => void handleExport("xlsx")}
              >
                <FileSpreadsheet className="size-4" />
                Excel
              </Button>
            </div>
          </div>


          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            {!resultsQuery.isLoading && !resultsQuery.isError && rows.length > 0 ? (
              <div className="flex flex-col gap-1">
                <p className="type-meta">
                   Trang {page}/{pageCount} · {rows.length} người đạt điểm (từ {all.length} bản ghi gần nhất).
                </p>
                <p className="text-[11px] font-bold text-muted-foreground uppercase">
                   Thống kê tham gia: {rows.length} người đạt (≥50%) • {Math.max(0, new Set(all.map((r: any) => r.employee_id)).size - rows.length)} người chưa đạt • Tổng số người đã dự thi được ghi nhận đồng bộ.
                </p>
              </div>
            ) : null}
            {live ? (
              <p className="type-meta inline-flex items-center gap-1.5 text-success" aria-live="polite">
                <Radio className="size-3.5" />
                {pendingUpdates > 0
                  ? `${pendingUpdates} bài nộp mới — đang cập nhật...`
                  : "Đang cập nhật trực tiếp"}
              </p>
            ) : null}
          </div>

          <div className="mt-6">
            <QueryState
              isLoading={resultsQuery.isLoading}
              isError={resultsQuery.isError}
              error={resultsQuery.error}
              isFetching={resultsQuery.isFetching}
              onRetry={() => void resultsQuery.refetch()}
              isEmpty={rows.length === 0}
              skeleton={<ListSkeleton rows={6} height="h-20" />}
              empty={
                keyword.trim() || quizId !== "all" ? (
                  <EmptyState
                    icon={SearchX}
                    title="Không có kết quả phù hợp"
                    description="Thử xoá từ khoá tìm kiếm hoặc chọn lại cuộc thi khác."
                action={
                      <Button
                        variant="outline"
                        className="rounded-full"
                        onClick={() => {
                          setKeyword("");
                          const featured = quizzesQuery.data?.find(q => q.is_featured);
                          setQuizId(featured ? featured.id : "all");
                        }}
                      >
                        Xoá bộ lọc
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={Trophy}
                    title="Chưa có thí sinh nào đạt"
                    description="Bảng xếp hạng chỉ ghi nhận bài thi đúng từ 50% số câu trở lên."
                  />
                )
              }
            >
              <ol className="space-y-3">
                <TooltipProvider>
                  {pageRows.map((r, offset) => {
                    const i = (page - 1) * pageSize + offset;
                    const attempts = (r as any).attempts ?? 1;
                    const submitted = (r as any).submitted ?? 1;
                    const abandoned = Math.max(0, attempts - submitted);

                    return (
                      <li
                        key={(r as any).id}
                        className={cn(
                          "game-card animate-pop grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 sm:gap-4 sm:p-5",
                          i < 3 && "ring-1 ring-gold/40",
                        )}
                        style={{ animationDelay: `${Math.min(i, 10) * 0.04}s` }}
                      >
                        <span
                          className={cn(
                            "grid size-10 shrink-0 place-items-center rounded-2xl text-sm font-extrabold sm:size-12",
                            i === 0 && "surface-gold shadow-[var(--shadow-gold)]",
                            i === 1 && "bg-secondary text-secondary-foreground",
                            i === 2 && "bg-accent/25 text-accent-foreground",
                            i > 2 && "bg-secondary text-muted-foreground",
                          )}
                        >
                          {i < 3 ? <Medal className="size-5" /> : i + 1}
                        </span>

                        <div className="min-w-0">
                          <p className="truncate font-heading font-bold">{r.candidate_name}</p>
                          <p className="type-meta truncate">{r.unit}</p>
                          
                          <div className="flex flex-wrap items-center gap-x-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="type-meta mt-0.5 inline-flex cursor-help items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-medium transition-colors hover:bg-secondary/80"
                                >
                                  <RotateCcw aria-hidden className="size-3" />
                                  {attempts} lượt thi
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="flex flex-col gap-1 p-2.5">
                                <p className="font-bold">Chi tiết lượt thi</p>
                                <div className="space-y-1 text-[11px]">
                                  <p className="flex justify-between gap-4 text-success">
                                    <span>Hoàn thành & nộp bài:</span>
                                    <span className="font-bold">{submitted}</span>
                                  </p>
                                  <p className="flex justify-between gap-4 text-destructive">
                                    <span>Bỏ giữa chừng:</span>
                                    <span className="font-bold">{abandoned}</span>
                                  </p>
                                  <div className="mt-1 border-t border-primary-foreground/10 pt-1 opacity-70">
                                    Khi bằng điểm và thời gian, ai thi ít lượt hơn xếp trên.
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>

                            <p className="type-meta mt-0.5 truncate">
                              {(r as any).quiz_title}
                              <span className="hidden sm:inline"> • {formatDateTime((r as any).submitted_at)}</span>
                            </p>
                          </div>
                        </div>

                    <div className="shrink-0 text-right">
                      <p className="font-mono text-lg font-extrabold text-primary">
                        {r.points ?? 0}
                        <span className="text-sm text-muted-foreground"> đ</span>
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {r.score}/{r.total} câu
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">{formatSeconds(r.time_seconds)}</p>
                    </div>
                  </li>
                  );
                })}
                </TooltipProvider>
              </ol>
              {pageCount > 1 ? (
                <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Phân trang bảng xếp hạng">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Trang trước
                  </Button>
                  <span className="type-meta px-2">
                    {page} / {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    disabled={page === pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    Trang sau
                  </Button>
                </nav>
              ) : null}
            </QueryState>
          </div>
      </div>
    </AppShell>
  );

}
