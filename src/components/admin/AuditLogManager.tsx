import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { History, RefreshCw, ScrollText, SearchX } from "lucide-react";

import { AdminSection, EmptyState, ListSkeleton, QueryState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { AUDIT_ACTION_LABEL, AUDIT_ENTITY_LABEL, type AuditLogRow } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const RANGES = [
  { value: "24h", label: "24 giờ qua", hours: 24 },
  { value: "7d", label: "7 ngày qua", hours: 24 * 7 },
  { value: "30d", label: "30 ngày qua", hours: 24 * 30 },
  { value: "all", label: "Tất cả", hours: 0 },
] as const;

function reasonOf(log: AuditLogRow) {
  const details = log.details as { reason?: string } | null;
  return typeof details?.reason === "string" && log.action.startsWith("login") ? details.reason : "";
}

const actionTone: Record<string, string> = {
  create: "bg-emerald-500/12 text-emerald-700",
  update: "bg-amber-500/12 text-amber-700",
  delete: "bg-destructive/12 text-destructive",
  import: "bg-primary/12 text-primary",
  export: "bg-muted text-muted-foreground",
  login_success: "bg-primary/12 text-primary",
  login_failed: "bg-destructive/12 text-destructive",
};

export function AuditLogManager() {
  const qc = useQueryClient();
  const [live, setLive] = useState(true);
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("7d");
  const [actor, setActor] = useState("all");
  const [entity, setEntity] = useState("all");
  const [keyword, setKeyword] = useState("");

  const logsQuery = useQuery({
    queryKey: ["audit-logs", range],
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("id, user_id, actor_email, action, entity, entity_id, entity_label, details, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      const hours = RANGES.find((r) => r.value === range)?.hours ?? 0;
      if (hours > 0) q = q.gte("created_at", new Date(Date.now() - hours * 3600_000).toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data as AuditLogRow[];
    },
  });

  // Theo dõi realtime: mọi bản ghi mới (kể cả đăng nhập nhanh) hiện ngay.
  useEffect(() => {
    if (!live) return;
    const channel = supabase
      .channel("audit-logs-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_logs" }, () => {
        void qc.invalidateQueries({ queryKey: ["audit-logs"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [live, qc]);

  const logs = logsQuery.data ?? [];
  const actors = useMemo(
    () => Array.from(new Set(logs.map((l) => l.actor_email).filter(Boolean))).sort(),
    [logs],
  );

  const rows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return logs.filter(
      (l) =>
        (actor === "all" || l.actor_email === actor) &&
        (entity === "all" || l.entity === entity) &&
        (!kw || l.entity_label.toLowerCase().includes(kw) || l.actor_email.toLowerCase().includes(kw)),
    );
  }, [logs, actor, entity, keyword]);

  return (
    <AdminSection
      title="Lịch sử thao tác"
      description={logsQuery.isLoading ? "Đang tải..." : `${rows.length} bản ghi`}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm theo đối tượng hoặc email..."
            className="rounded-full sm:w-64"
          />
          <Select value={actor} onValueChange={setActor}>
            <SelectTrigger className="w-full rounded-full sm:w-56">
              <SelectValue placeholder="Người thực hiện" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi người dùng</SelectItem>
              {actors.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="w-full rounded-full sm:w-44">
              <SelectValue placeholder="Đối tượng" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi đối tượng</SelectItem>
              {Object.entries(AUDIT_ENTITY_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
            <SelectTrigger className="w-full rounded-full sm:w-40">
              <SelectValue placeholder="Thời gian" />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
      actions={
        <>
        <Button
          variant={live ? "default" : "outline"}
          className="rounded-full"
          aria-pressed={live}
          onClick={() => setLive((v) => !v)}
        >
          <span className={cn("size-2 rounded-full bg-current", live && "animate-pulse")} />
          {live ? "Đang theo dõi trực tiếp" : "Tạm dừng theo dõi"}
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => void logsQuery.refetch()}
          disabled={logsQuery.isFetching}
        >
          <RefreshCw className={cn("size-4", logsQuery.isFetching && "animate-spin")} /> Làm mới
        </Button>
        </>
      }
    >
      <QueryState
        isLoading={logsQuery.isLoading}
        isError={logsQuery.isError}
        error={logsQuery.error}
        isFetching={logsQuery.isFetching}
        onRetry={() => void logsQuery.refetch()}
        isEmpty={rows.length === 0}
        skeleton={<ListSkeleton rows={6} height="h-16" />}
        empty={
          <EmptyState
            icon={logs.length === 0 ? ScrollText : SearchX}
            title={logs.length === 0 ? "Chưa có thao tác nào được ghi nhận" : "Không có bản ghi phù hợp"}
            description={
              logs.length === 0
                ? "Mọi thao tác tạo, sửa, xoá trong khu quản trị sẽ được ghi lại tại đây."
                : "Thử đổi bộ lọc người dùng, đối tượng hoặc khoảng thời gian."
            }
          />
        }
      >
        <div className="card-elevated divide-y divide-border overflow-hidden">
          {rows.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-secondary/50">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold",
                  actionTone[l.action] ?? "bg-muted text-muted-foreground",
                )}
              >
                {AUDIT_ACTION_LABEL[l.action as keyof typeof AUDIT_ACTION_LABEL] ?? l.action}
              </span>
              <span className="type-meta rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">
                {AUDIT_ENTITY_LABEL[l.entity as keyof typeof AUDIT_ENTITY_LABEL] ?? l.entity}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {l.entity_label || "—"}
                {reasonOf(l) ? <span className="type-meta ml-2 text-muted-foreground">· {reasonOf(l)}</span> : null}
              </span>
              <span className="type-meta text-muted-foreground">{l.actor_email}</span>
              <span className="type-meta flex items-center gap-1 font-mono text-muted-foreground">
                <History className="size-3.5" />
                {formatDateTime(l.created_at)}
              </span>
            </div>
          ))}
        </div>
      </QueryState>
    </AdminSection>
  );
}
