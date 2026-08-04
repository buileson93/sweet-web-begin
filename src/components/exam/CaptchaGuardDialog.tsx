import { useState } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { getTurnstileToken } from "@/lib/turnstile";

/**
 * Khoá phòng thi khi phát hiện dấu hiệu tự động hoá: chỉ mở lại sau khi
 * vượt qua một lần xác minh Turnstile mới (người thật chỉ mất vài giây).
 */
export function CaptchaGuardDialog(props: {
  open: boolean;
  onVerify: (token: string | undefined) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const token = await getTurnstileToken("exam-guard");
      const ok = await props.onVerify(token);
      if (!ok) setError("Xác minh chưa đạt. Vui lòng thử lại.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xác minh được, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={props.open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-destructive" aria-hidden />
            Tạm khoá thao tác
          </AlertDialogTitle>
          <AlertDialogDescription>
            Hệ thống ghi nhận dấu hiệu trình duyệt bị điều khiển tự động. Đồng hồ vẫn chạy; hãy xác
            minh lại để mở khoá bài làm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button onClick={() => void run()} disabled={busy} className="w-full">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Xác minh lại để tiếp tục
        </Button>
      </AlertDialogContent>
    </AlertDialog>
  );
}
