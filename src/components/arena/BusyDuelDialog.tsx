import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, DoorOpen, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BusyInfo } from "@/lib/arena/rooms";

/**
 * Khi một thao tác bị chặn vì "đang ở trong một trận khác", hộp thoại này
 * cho hai lối thoát rõ ràng: quay lại trận cũ, hoặc rời ngay rồi thử lại.
 */
export function BusyDuelDialog({
  busy,
  onClose,
  onLeave,
  onLeft,
}: {
  busy: BusyInfo | null;
  onClose: () => void;
  /** Gọi server để rời/kết thúc ván đang mở. */
  onLeave: () => Promise<unknown>;
  /** Chạy sau khi rời thành công (thường là thử lại thao tác cũ). */
  onLeft?: () => void;
}) {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  if (!busy) return null;

  return (
    <Dialog open onOpenChange={(o) => (!o && !leaving ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" /> Bạn đang bận một ván khác
          </DialogTitle>
          <DialogDescription>{busy.message}</DialogDescription>
        </DialogHeader>

        {!busy.freeToLeave ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            Ván đang diễn ra: nếu rời bây giờ bạn bị xử thua kỹ thuật và có thể bị trừ Elo.
          </p>
        ) : (
          <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400">
            Ván chưa bắt đầu nên rời phòng lúc này không ảnh hưởng Elo.
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            className="rounded-full"
            disabled={leaving}
            onClick={() => {
              onClose();
              void navigate({ to: "/dau-truong/$duelId", params: { duelId: busy.duelId } });
            }}
          >
            <PlayCircle className="mr-2 size-4" /> Vào lại ván đó
          </Button>
          <Button
            variant={busy.freeToLeave ? "default" : "destructive"}
            className="rounded-full"
            disabled={leaving}
            onClick={async () => {
              setLeaving(true);
              try {
                await onLeave();
                toast.success("Đã rời ván cũ. Bạn có thể so tài tiếp.");
                onClose();
                onLeft?.();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Không rời được ván cũ.");
              } finally {
                setLeaving(false);
              }
            }}
          >
            {leaving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <DoorOpen className="mr-2 size-4" />
            )}
            {busy.freeToLeave ? "Rời & thử lại" : "Rời, chấp nhận thua"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
