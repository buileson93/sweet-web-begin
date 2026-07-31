import { useEffect, useState } from "react";
import { Check, Swords, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type IncomingInvite = { id: string; from_name: string; expires_at: string };

/**
 * Hộp thoại bật lên khi có đồng nghiệp thách đấu: nhận hoặc từ chối,
 * kèm đồng hồ đếm ngược đến khi lời mời hết hạn.
 */
export function InviteDialog({
  invite,
  onAccept,
  onDecline,
}: {
  invite: IncomingInvite | null;
  onAccept: (inviteId: string) => Promise<void> | void;
  onDecline: (inviteId: string) => Promise<void> | void;
}) {
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!invite) return;
    const tick = () =>
      setLeft(Math.max(0, Math.round((Date.parse(invite.expires_at) - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [invite]);

  if (!invite) return null;

  return (
    <Dialog open onOpenChange={() => void onDecline(invite.id)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="size-5 text-primary" /> Lời thách đấu
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-foreground">{invite.from_name}</span> mời bạn vào một
            ván so tài. Còn {left}s để trả lời.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onDecline(invite.id);
              setBusy(false);
            }}
          >
            <X className="mr-2 size-4" /> Từ chối
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onAccept(invite.id);
              setBusy(false);
            }}
          >
            <Check className="mr-2 size-4" /> Nhận lời
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
