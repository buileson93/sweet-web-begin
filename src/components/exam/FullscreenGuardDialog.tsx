import { useState } from "react";
import { Expand, Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Bắt buộc phòng thi chạy ở chế độ toàn màn hình. Chỉ mở lại màn hình bình thường
 * khi thí sinh nộp bài hoặc thoát phòng thi.
 */
export function FullscreenGuardDialog(props: {
  open: boolean;
  onEnter: () => Promise<boolean>;
  onExitRoom: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    const ok = await props.onEnter();
    if (!ok) setError("Trình duyệt chưa cho phép toàn màn hình. Hãy bấm lại nút bên dưới.");
    setBusy(false);
  };

  return (
    <AlertDialog open={props.open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Expand className="size-5 text-accent" aria-hidden />
            Bật chế độ toàn màn hình
          </AlertDialogTitle>
          <AlertDialogDescription>
            Phòng thi yêu cầu toàn màn hình để bảo đảm công bằng. Màn hình chỉ trở lại bình thường
            khi bạn nộp bài hoặc thoát phòng thi. Đồng hồ vẫn đang chạy.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-col gap-2">
          <Button onClick={() => void run()} disabled={busy} className="w-full">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Vào toàn màn hình và làm bài
          </Button>
          <Button variant="ghost" className="w-full" onClick={props.onExitRoom}>
            Thoát phòng thi
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
