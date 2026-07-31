import { useState } from "react";
import { ClipboardCheck, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DIAG_LABELS, formatDiagReport, type DiagEntry } from "@/lib/arena/diagnostics";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  connect: "text-success",
  reconnect: "text-warning",
  disconnect: "text-destructive",
  timeout: "text-destructive",
  error: "text-destructive",
  slow: "text-warning",
  reconcile: "text-primary",
  duplicate: "text-muted-foreground",
  stale: "text-muted-foreground",
};

/** Màn hình xem nhật ký sự cố realtime theo từng ván, kèm nút sao chép báo cáo. */
export function DiagnosticsDialog({
  open,
  onOpenChange,
  entries,
  meta,
  onClear,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entries: DiagEntry[];
  meta: { duelId: string; round?: number; version?: number; ping?: number | null; skew?: number; reconnects?: number };
  onClear?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyReport() {
    const text = formatDiagReport(meta, entries);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Đã sao chép báo cáo sự cố.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Trình duyệt không cho phép sao chép.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nhật ký sự cố ván so tài</DialogTitle>
          <DialogDescription>
            Ghi lại các lần kết nối lại, đồng bộ lại, quá thời gian và gói tin bị bỏ. Sao chép nội
            dung này khi cần báo lỗi lệch trạng thái.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl border bg-muted/40 p-2">
            <p className="font-mono font-bold tabular-nums">{meta.ping ?? "—"}ms</p>
            <p className="text-[10px] text-muted-foreground">Ping</p>
          </div>
          <div className="rounded-xl border bg-muted/40 p-2">
            <p className="font-mono font-bold tabular-nums">{Math.round(meta.skew ?? 0)}ms</p>
            <p className="text-[10px] text-muted-foreground">Lệch đồng hồ</p>
          </div>
          <div className="rounded-xl border bg-muted/40 p-2">
            <p className="font-mono font-bold tabular-nums">{meta.reconnects ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">Kết nối lại</p>
          </div>
        </div>

        <ol className="max-h-72 space-y-1 overflow-y-auto rounded-xl border bg-card p-2 text-xs">
          {entries.length === 0 ? (
            <li className="p-3 text-center text-muted-foreground">
              Chưa ghi nhận sự cố nào — kết nối đang ổn định.
            </li>
          ) : (
            [...entries].reverse().map((e) => (
              <li key={e.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {new Date(e.at).toLocaleTimeString("vi-VN", { hour12: false })}
                </span>
                <span className={cn("font-semibold", TONE[e.kind] ?? "text-foreground")}>
                  {DIAG_LABELS[e.kind]}
                </span>
                <span className="min-w-0 flex-1 text-muted-foreground">{e.message}</span>
              </li>
            ))
          )}
        </ol>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={copyReport}>
            {copied ? <ClipboardCheck className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
            Sao chép báo cáo
          </Button>
          {onClear ? (
            <Button variant="outline" onClick={onClear} title="Xoá nhật ký">
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
