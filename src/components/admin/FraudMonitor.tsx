import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { 
  ShieldAlert, 
  ShieldCheck, 
  ShieldQuestion, 
  Fingerprint, 
  History, 
  Download, 
  AlertTriangle,
  Eye,
  Info,
  Smartphone,
  Globe,
  Monitor,
  SearchX,
  RefreshCw
} from "lucide-react";

import { AdminSection, EmptyState, ListSkeleton, QueryState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getFraudReport, getAttemptEvents } from "@/lib/fraud.functions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FraudAttempt, FraudRiskLevel } from "@/lib/fraudTypes";
import { downloadXlsx } from "@/lib/xlsxIo";

const RISK_CONFIG: Record<FraudRiskLevel, { label: string; icon: any; color: string; bg: string }> = {
  high: { label: "Cao", icon: ShieldAlert, color: "text-destructive", bg: "bg-destructive/10" },
  medium: { label: "Trung bình", icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-100" },
  low: { label: "Thấp", icon: ShieldQuestion, color: "text-blue-600", bg: "bg-blue-100" },
};

export function FraudMonitor() {
  const fetchReport = useServerFn(getFraudReport);
  const fetchEvents = useServerFn(getAttemptEvents);
  
  const [minIntegrity, setMinIntegrity] = useState(95);
  const [selectedAttempt, setSelectedAttempt] = useState<FraudAttempt | null>(null);

  const reportQuery = useQuery({
    queryKey: ["admin-fraud-report", minIntegrity],
    queryFn: () => fetchReport({ data: { minIntegrity } }),
  });

  const eventsQuery = useQuery({
    queryKey: ["admin-attempt-events", selectedAttempt?.sessionId],
    enabled: !!selectedAttempt,
    queryFn: () => fetchEvents({ data: { sessionId: selectedAttempt!.sessionId } }),
  });

  const attempts = reportQuery.data || [];

  const summary = useMemo(() => {
    return {
      total: attempts.length,
      high: attempts.filter(a => a.riskLevel === 'high').length,
      medium: attempts.filter(a => a.riskLevel === 'medium').length,
      uniqueDevices: new Set(attempts.map(a => a.fingerprint).filter(Boolean)).size,
    };
  }, [attempts]);

  async function exportExcel() {
    if (!attempts.length) return;
    
    await downloadXlsx([
      {
        name: "CanhBaoGianLan",
        data: [
          ["Thời gian", "Thí sinh", "Đơn vị", "Cuộc thi", "Điểm liêm chính", "Mức độ rủi ro", "Lý do", "Fingerprint", "Thiết bị"],
          ...attempts.map(a => [
            formatDateTime(a.startedAt),
            a.candidateName,
            a.unit,
            a.quizTitle,
            a.integrityScore,
            RISK_CONFIG[a.riskLevel].label,
            a.riskReason,
            a.fingerprint,
            `${a.deviceInfo?.browser || ''} ${a.deviceInfo?.os || ''}`
          ])
        ]
      }
    ], `bao-cao-nghi-van-gian-lan-${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  return (
    <AdminSection
      title="Giám sát & Chống gian lận"
      description="Phát hiện các hành vi bất thường, thi hộ hoặc sử dụng công cụ can thiệp."
      toolbar={
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Ngưỡng liêm chính:</span>
          <Select value={String(minIntegrity)} onValueChange={v => setMinIntegrity(Number(v))}>
            <SelectTrigger className="w-32 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[100, 99, 95, 90, 80, 70].map(v => (
                <SelectItem key={v} value={String(v)}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
      actions={
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full" onClick={exportExcel} disabled={!attempts.length}>
            <Download className="size-4" /> Xuất báo cáo
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => reportQuery.refetch()}>
            <RefreshCw className={cn("size-4", reportQuery.isFetching && "animate-spin")} /> Làm mới
          </Button>
        </div>
      }
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Tổng nghi vấn", value: summary.total, icon: AlertTriangle, color: "text-primary" },
          { label: "Rủi ro cao", value: summary.high, icon: ShieldAlert, color: "text-destructive" },
          { label: "Rủi ro trung bình", value: summary.medium, icon: AlertTriangle, color: "text-amber-600" },
          { label: "Thiết bị nghi vấn", value: summary.uniqueDevices, icon: Fingerprint, color: "text-accent" },
        ].map((s) => (
          <div key={s.label} className="card-elevated p-4">
            <div className="flex items-center justify-between">
              <s.icon className={cn("size-5", s.color)} />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold">{s.value}</p>
            <p className="type-eyebrow text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <QueryState
        isLoading={reportQuery.isLoading}
        isError={reportQuery.isError}
        error={reportQuery.error}
        isEmpty={attempts.length === 0}
        skeleton={<ListSkeleton rows={5} height="h-20" />}
        empty={
          <EmptyState
            icon={ShieldCheck}
            title="Chưa phát hiện nghi vấn nào"
            description="Hệ thống chưa ghi nhận các lượt thi có dấu hiệu vi phạm hoặc điểm liêm chính thấp hơn ngưỡng đã chọn."
          />
        }
      >
        <div className="card-elevated divide-y divide-border overflow-hidden">
          {attempts.map((a) => {
            const Config = RISK_CONFIG[a.riskLevel];
            return (
              <div key={a.sessionId} className="group flex flex-col gap-4 p-4 transition-colors hover:bg-secondary/40 sm:flex-row sm:items-center">
                <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", Config.bg)}>
                  <Config.icon className={cn("size-6", Config.color)} />
                </div>
                
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{a.candidateName}</span>
                    <Badge variant="outline" className="font-normal">{a.unit}</Badge>
                    <span className={cn("font-mono text-sm font-bold", a.integrityScore < 70 ? "text-destructive" : "text-amber-600")}>
                      Liêm chính: {a.integrityScore}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Cuộc thi: <span className="text-foreground">{a.quizTitle}</span>
                  </p>
                  <p className="text-xs italic text-destructive/80">
                    Lý do: {a.riskReason}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground sm:justify-end">
                  <div className="flex items-center gap-1">
                    <History className="size-3.5" />
                    {formatDateTime(a.startedAt)}
                  </div>
                  <div className="flex items-center gap-1 font-mono">
                    <Fingerprint className="size-3.5" />
                    {a.fingerprint?.slice(0, 12)}...
                  </div>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="rounded-full"
                    onClick={() => setSelectedAttempt(a)}
                  >
                    <Eye className="size-3.5" /> Chi tiết
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </QueryState>

      <Dialog open={!!selectedAttempt} onOpenChange={o => !o && setSelectedAttempt(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết nghi vấn: {selectedAttempt?.candidateName}</DialogTitle>
            <DialogDescription>
              Phân tích các hành vi và thông tin thiết bị trong phiên thi này.
            </DialogDescription>
          </DialogHeader>

          {selectedAttempt && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border p-4">
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    <Info className="size-4" /> Thông tin thiết bị
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Địa chỉ IP:</span>
                      <span className="font-medium">{selectedAttempt.deviceInfo?.ip || "Không rõ"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe className="size-3.5" />
                      <span className="truncate">{selectedAttempt.deviceInfo?.browser} {selectedAttempt.deviceInfo?.browserVersion}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Monitor className="size-3.5" />
                      <span>{selectedAttempt.deviceInfo?.os} {selectedAttempt.deviceInfo?.osVersion}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Smartphone className="size-3.5" />
                      <span>{selectedAttempt.deviceInfo?.deviceModel || selectedAttempt.deviceInfo?.deviceType}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border p-4">
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    <AlertTriangle className="size-4" /> Sự kiện bất thường
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(selectedAttempt.eventSummary).length > 0 ? (
                      Object.entries(selectedAttempt.eventSummary).map(([kind, count]) => (
                        <div key={kind} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-1.5 text-sm">
                          <span className="capitalize">{kind.replace(/_/g, ' ')}</span>
                          <Badge variant="destructive" className="font-mono">{count}</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Không ghi nhận sự kiện vi phạm cụ thể.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  <History className="size-4" /> Nhật ký chi tiết
                </h4>
                <div className="max-h-60 space-y-2 overflow-y-auto pr-2">
                  {eventsQuery.isLoading ? (
                    <ListSkeleton rows={3} height="h-12" />
                  ) : eventsQuery.data?.length ? (
                    eventsQuery.data.map((log: any) => (
                      <div key={log.id} className="flex gap-3 rounded-xl border border-border/50 p-3 text-sm">
                        <div className="shrink-0 font-mono text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleTimeString('vi-VN')}
                        </div>
                        <div className="flex-1">
                          <span className="font-bold capitalize">{log.kind.replace(/_/g, ' ')}</span>
                          {log.details?.reason && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{log.details.reason}</p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                  <EmptyState
                    icon={SearchX}
                    title="Không có log chi tiết"
                  />

                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminSection>
  );
}
