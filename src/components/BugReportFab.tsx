import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Bug, ImagePlus, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitBugReport } from "@/lib/bugReports.functions";
import { readPlayerIdentity } from "@/lib/playerIdentity";
import { compressShot } from "@/lib/bugShot";
import { collectFullVisit } from "@/lib/deviceInfo";
import { readQuickLogin } from "@/lib/quickLogin";

const KINDS = [
  { value: "bug", label: "Báo lỗi" },
  { value: "idea", label: "Góp ý cải thiện" },
  { value: "thanks", label: "Lời cảm ơn" },
];

/**
 * Nút nổi "Báo lỗi": người dùng gửi mô tả kèm ảnh chụp màn hình đã nén.
 * Ẩn trong lúc đang làm bài và trong khu quản trị để không gây phân tâm.
 */
export function BugReportFab() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const hidden =
    pathname.startsWith("/thi") ||
    pathname.startsWith("/quan-tri") ||
    pathname.startsWith("/nhap-du-lieu") ||
    pathname.startsWith("/nhat-ky") ||
    pathname.startsWith("/auth");

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Báo lỗi hoặc góp ý"
        title="Báo lỗi hoặc góp ý"
        className="fixed right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 inline-flex size-12 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-[var(--shadow-lift)] backdrop-blur transition-transform hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95 lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <Bug className="size-5" strokeWidth={2.2} />
      </button>
      <BugReportDialog open={open} onOpenChange={setOpen} path={pathname} />
    </>
  );
}

function BugReportDialog({
  open,
  onOpenChange,
  path,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  path: string;
}) {
  const [kind, setKind] = useState("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [shot, setShot] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function pickImage(file?: File | null) {
    if (!file) return;
    try {
      setShot(await compressShot(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không đọc được ảnh");
    }
  }

  async function send() {
    if (description.trim().length < 5) {
      toast.error("Vui lòng mô tả rõ hơn để chúng tôi khắc phục.");
      return;
    }
    setBusy(true);
    try {
      const device = await collectFullVisit(path);
      const result = await submitBugReport({
        data: {
          kind,
          title,
          description,
          contact,
          reporter_name: readQuickLogin()?.name ?? "",
          employee_id: readPlayerIdentity()?.employeeId ?? "",
          path,
          device: device as unknown as Record<string, unknown>,
          user_agent: navigator.userAgent ?? "",
          ...(shot ? { shot_data_url: shot } : {}),
        },
      });
      if (!result.ok) {
        toast.error(result.message ?? "Không gửi được, vui lòng thử lại.");
        return;
      }
      toast.success("Đã gửi! Cảm ơn bạn đã giúp hệ thống tốt hơn.");
      setTitle("");
      setDescription("");
      setContact("");
      setShot("");
      onOpenChange(false);
    } catch {
      toast.error("Không gửi được, vui lòng kiểm tra kết nối mạng.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Góp ý giúp VATM tốt hơn</DialogTitle>
          <DialogDescription>
            Cảm ơn bạn dành thời gian chia sẻ! Mỗi góp ý — dù là một lỗi nhỏ hay một ý tưởng mới — đều giúp
            nền tảng VATM ngày càng hoàn thiện và thân thiện hơn với cộng đồng. Hãy mô tả sự cố bạn gặp phải,
            kèm ảnh chụp màn hình nếu có. Thông tin thiết bị sẽ được gửi kèm để đội kỹ thuật tái hiện và xử lý
            nhanh nhất.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            className="rounded-xl"
            placeholder="Mô tả ngắn gọn vấn đề bạn gặp (không bắt buộc)"
            value={title}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            className="min-h-28 rounded-xl"
            placeholder="Bạn đang thao tác gì, màn hình hiển thị ra sao? Càng rõ ràng, chúng tôi càng khắc phục nhanh được."
            value={description}
            maxLength={4000}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            className="rounded-xl"
            placeholder="Để lại số điện thoại/email để chúng tôi phản hồi (không bắt buộc)"
            value={contact}
            maxLength={160}
            onChange={(e) => setContact(e.target.value)}
          />

          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-2 text-sm font-semibold transition-colors hover:bg-secondary">
              <ImagePlus className="size-4" />
              {shot ? "Đổi ảnh" : "Đính kèm ảnh"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void pickImage(e.target.files?.[0])}
              />
            </label>
            {shot && (
              <div className="relative">
                <img src={shot} alt="Ảnh đính kèm" className="h-16 w-24 rounded-lg border border-border object-cover" />
                <button
                  type="button"
                  aria-label="Bỏ ảnh đính kèm"
                  onClick={() => setShot("")}
                  className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-destructive text-destructive-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
          </div>

          <Button className="w-full rounded-xl font-bold" onClick={() => void send()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Gửi góp ý
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
