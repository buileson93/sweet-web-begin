import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Eye, Loader2, RadioTower, RefreshCw, Users } from "lucide-react";

import { AdminSection, EmptyState, ListSkeleton, QueryState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getSessionDetail,
  listLiveSessions,
  type LivePage,
  type LiveSession,
  type SessionDetail,
} from "@/lib/monitor.functions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

function remaining(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "hết giờ";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Tab đang hiển thị hay không — ẩn tab thì ngừng làm mới để đỡ tải máy chủ. */
function useTabVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === "visible");
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

export function LiveMonitor() {
  const fetchLive = useServerFn(listLiveSessions);
  const fetchDetail = useServerFn(getSessionDetail);
  const [auto, setAuto] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const visible = useTabVisible();

  // Giữ dữ liệu đã tải để khi máy chủ báo "không đổi" thì không phải dựng lại bảng.
  const cacheRef = useRef<{ version: string; rows: LiveSession[] } | null>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [changed, setChanged] = useState(false);


  const detailQuery = useQuery({
    queryKey: ["admin-session-detail", openId],
    enabled: Boolean(openId),
    refetchInterval: openId && visible ? 15_000 : false,
    queryFn: () => fetchDetail({ data: { sessionId: openId! } }) as Promise<SessionDetail>,
  });

  const query = useQuery({
    queryKey: ["admin-live-sessions", limit],
    refetchInterval: auto && visible ? 10_000 : false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const page = (await fetchLive({
        data: { limit, offset: 0, knownVersion: cacheRef.current?.version },
      })) as LivePage;
      const rows = page.changed ? page.rows : (cacheRef.current?.rows ?? []);
      cacheRef.current = { version: page.version, rows };
      setSyncedAt(new Date());
      setChanged(page.changed);
      return { ...page, rows };
    },
  });

  const page = query.data;
  const rows = page?.rows ?? [];
  const activeCount = page?.activeCount ?? 0;
  const submittedCount = page?.submittedCount ?? 0;
  const syncLabel = query.isFetching
    ? "Đang đồng bộ…"
    : query.isError
      ? "Mất kết nối"
      : syncedAt
        ? `Đồng bộ ${syncedAt.toLocaleTimeString("vi-VN")} · ${changed ? "có thay đổi" : "không đổi"}`
        : "Chưa đồng bộ";

  return (
    <AdminSection
      title="Theo dõi kỳ thi trực tiếp"
      description={
        query.isLoading
          ? "Đang tải..."
          : `${activeCount} thí sinh đang làm bài · ${submittedCount} bài đã nộp (2 giờ gần nhất)`
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm">
            <Users className="size-4 text-accent" /> Đang thi: <b className="font-mono">{activeCount}</b>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm">
            <CheckCircle2 className="size-4 text-accent" /> Đã nộp: <b className="font-mono">{submittedCount}</b>
          </span>
          <span
            className={cn(
              "type-meta inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
              query.isError ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground",
            )}
            aria-live="polite"
          >
            {query.isFetching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <span
                className={cn(
                  "size-2 rounded-full",
                  query.isError ? "bg-destructive" : changed ? "bg-primary" : "bg-accent",
                )}
              />
            )}
            {syncLabel}
            {!visible ? " · tạm dừng (tab ẩn)" : ""}
          </span>
        </div>
      }

      actions={
        <div className="flex gap-2">
          <Button variant={auto ? "default" : "outline"} className="rounded-full" onClick={() => setAuto((v) => !v)}>
            <RadioTower className="size-4" /> {auto ? "Tự làm mới: Bật" : "Tự làm mới: Tắt"}
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => void query.refetch()}>
            <RefreshCw className={cn("size-4", query.isFetching && "animate-spin")} /> Làm mới
          </Button>
        </div>
      }
    >
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isFetching={query.isFetching}
        onRetry={() => void query.refetch()}
        isEmpty={rows.length === 0}
        skeleton={<ListSkeleton rows={4} height="h-14" />}
        empty={
          <EmptyState
            icon={RadioTower}
            title="Chưa có lượt thi nào gần đây"
            description="Bảng này hiển thị các phiên thi bắt đầu trong 2 giờ gần nhất."
          />
        }
      >
        <div className="card-elevated overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Thí sinh</th>
                <th className="px-4 py-3 font-semibold">Cuộc thi</th>
                <th className="px-4 py-3 font-semibold">Tiến độ</th>
                <th className="px-4 py-3 font-semibold">Còn lại</th>
                <th className="px-4 py-3 font-semibold">Bắt đầu</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const expired = new Date(r.expiresAt).getTime() <= Date.now();
                const done = Boolean(r.submittedAt);
                return (
                  <tr key={r.id} className="border-t border-border transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{r.candidateName}</p>
                      <p className="type-meta">{r.unit || "—"}</p>
                    </td>
                    <td className="max-w-[220px] px-4 py-3 text-muted-foreground">{r.quizTitle}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${r.total ? Math.round((r.answered / r.total) * 100) : 0}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs text-muted-foreground">
                          {r.answered}/{r.total}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {done ? "—" : remaining(r.expiresAt)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(r.startedAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          done
                            ? "bg-accent/15 text-accent"
                            : expired
                              ? "bg-destructive/10 text-destructive"
                              : "bg-primary/10 text-primary",
                        )}
                      >
                        {done ? "Đã nộp" : expired ? "Hết giờ" : "Đang thi"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full"
                        onClick={() => setOpenId(r.id)}
                      >
                        <Eye className="size-4" /> Chi tiết
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Tải dần: mặc định chỉ dựng 25 dòng, bấm để lấy thêm */}
        {page?.hasMore ? (
          <div className="mt-3 flex justify-center">
            <Button
              variant="outline"
              className="rounded-full"
              disabled={query.isFetching}
              onClick={() => setLimit((n) => Math.min(n + PAGE_SIZE, 100))}
            >
              {query.isFetching ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
              Tải thêm {PAGE_SIZE} phiên
            </Button>
          </div>
        ) : rows.length > PAGE_SIZE ? (
          <p className="type-meta mt-3 text-center">Đã hiển thị toàn bộ {rows.length} phiên gần đây.</p>
        ) : null}
      </QueryState>


      <Dialog open={Boolean(openId)} onOpenChange={(o) => setOpenId(o ? openId : null)}>
        <DialogContent className="max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailQuery.data?.candidateName ?? "Chi tiết bài thi"}</DialogTitle>
            <DialogDescription>
              {detailQuery.data
                ? `${detailQuery.data.quizTitle} · ${detailQuery.data.unit || "chưa rõ đơn vị"} · bắt đầu ${formatDateTime(detailQuery.data.startedAt)}`
                : "Đang tải tiến độ làm bài…"}
            </DialogDescription>
          </DialogHeader>

          {detailQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : detailQuery.isError ? (
            <p className="text-sm text-destructive">{(detailQuery.error as Error).message}</p>
          ) : detailQuery.data ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Đã trả lời", value: `${detailQuery.data.answers.filter((a) => a.answered).length}/${detailQuery.data.answers.length}` },
                  { label: "Đúng", value: String(detailQuery.data.answers.filter((a) => a.isCorrect).length) },
                  { label: "Chuỗi đúng dài nhất", value: String(detailQuery.data.bestStreak) },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-secondary px-3 py-2">
                    <p className="font-mono text-lg font-bold">{s.value}</p>
                    <p className="type-meta">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-3">
                  <p className="type-meta mb-1 font-semibold uppercase">Thông tin thí sinh</p>
                  <dl className="space-y-1 text-sm">
                    {[
                      ["Họ tên", detailQuery.data.candidate?.fullName || detailQuery.data.candidateName],
                      ["Chức danh", detailQuery.data.candidate?.position || "—"],
                      ["Đơn vị", detailQuery.data.candidate?.unit || detailQuery.data.unit || "—"],
                      ["Ngày sinh", detailQuery.data.candidate?.birthDate || "—"],
                      ["SĐT (4 số cuối)", detailQuery.data.candidate?.phoneLast4 || "—"],
                      ["Điểm liêm chính", String(detailQuery.data.integrityScore)],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="text-right font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="rounded-xl border p-3">
                  <p className="type-meta mb-1 font-semibold uppercase">Thiết bị &amp; mạng</p>
                  {detailQuery.data.device ? (
                    <dl className="space-y-1 text-sm">
                      {[
                        ["Địa chỉ IP", detailQuery.data.device.ip],
                        ["Trình duyệt", detailQuery.data.device.browser],
                        ["Hệ điều hành", detailQuery.data.device.os],
                        ["Loại thiết bị", detailQuery.data.device.deviceType],
                        ["Kiểu máy", detailQuery.data.device.deviceModel],
                        ["Màn hình", detailQuery.data.device.screen],
                        ["Kết nối", detailQuery.data.device.network],
                        ["lên kế hoạch để chống gian lận tôi thấy autosave_rate:too_fast hơi nhiều có vể tiêu chí này phát hiện script hơi sai", detailQuery.data.device.language],
                        ["Múi giờ", detailQuery.data.device.timezone],
                        ["Chạy dạng ứng dụng", detailQuery.data.device.isPwa ? "Có" : "Không"],
                        ["Ghi nhận lúc", formatDateTime(detailQuery.data.device.seenAt)],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className="text-right font-medium">{v}</dd>
                        </div>
                      ))}
                      <p className="type-meta break-all pt-1 text-muted-foreground">
                        {detailQuery.data.device.userAgent}
                      </p>
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Chưa ghi nhận được thiết bị của thí sinh này.
                    </p>
                  )}
                </div>
              </div>


              <ol className="space-y-2">
                {detailQuery.data.answers.map((a) => (
                  <li
                    key={a.questionId + a.index}
                    className={cn(
                      "rounded-xl border p-3 text-sm",
                      !a.answered
                        ? "border-border bg-secondary/40"
                        : a.isCorrect
                          ? "border-accent/40 bg-accent/10"
                          : "border-destructive/40 bg-destructive/5",
                    )}
                  >
                    <p className="font-semibold">
                      Câu {a.index + 1}. {a.question}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Thí sinh chọn: <span className="text-foreground">{a.answerLabel}</span>
                    </p>
                    {!a.isCorrect ? (
                      <p className="text-muted-foreground">
                        Đáp án đúng: <span className="text-foreground">{a.correctLabel}</span>
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminSection>
  );
}
