import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, UserRoundCog } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { savePlayerAvatar, type PlayerProfile } from "@/lib/player.functions";

const AvatarView3D = lazy(() => import("@/components/player/AvatarView3D"));

const RPM_URL = "https://vatm.readyplayer.me/avatar?frameApi&bodyType=fullbody&quality=high&textureAtlas=none&clearCache";

/** Ảnh chân dung 2D do Ready Player Me kết xuất từ mô hình GLB. */
function portraitOf(glbUrl: string) {
  return glbUrl.replace(/\.glb.*$/, ".png") + "?scene=halfbody-portrait-v1";
}

/**
 * Tạo nhân vật 3D bằng Ready Player Me rồi lưu vào hồ sơ người chơi.
 * Cần xác thực lại bằng danh bạ để không ai đổi avatar của người khác.
 */
export function AvatarCreatorDialog({
  name,
  credential,
  onSaved,
  currentUrl,
}: {
  name: string;
  credential: string;
  onSaved?: (profile: PlayerProfile) => void;
  currentUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(currentUrl ?? "");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const runSave = useServerFn(savePlayerAvatar);

  const save = useMutation({
    mutationFn: (avatarUrl: string) =>
      runSave({ data: { name, credential, avatarUrl, avatarImage: portraitOf(avatarUrl) } }),
    onSuccess: (profile) => {
      toast.success("Đã lưu nhân vật 3D của bạn");
      onSaved?.(profile);
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Không lưu được nhân vật"),
  });

  useEffect(() => {
    if (!open) return;
    function onMessage(event: MessageEvent) {
      if (!String(event.origin).includes("readyplayer.me")) return;
      let payload: { eventName?: string; data?: { url?: string } } | null = null;
      try {
        payload = typeof event.data === "string" ? JSON.parse(event.data) : (event.data as never);
      } catch {
        return;
      }
      if (payload?.eventName === "v1.frame.ready") {
        frameRef.current?.contentWindow?.postMessage(
          JSON.stringify({ target: "readyplayerme", type: "subscribe", eventName: "v1.**" }),
          "*",
        );
      }
      if (payload?.eventName === "v1.avatar.exported" && payload.data?.url) {
        setPreview(payload.data.url);
        save.mutate(payload.data.url);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, save]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="rounded-full">
          <UserRoundCog className="size-4" />
          {currentUrl ? "Đổi nhân vật 3D" : "Tạo nhân vật 3D"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nhân vật 3D của bạn</DialogTitle>
          <DialogDescription>
            Chụp ảnh hoặc chọn khuôn mặt có sẵn, xong bấm “Next” để lưu vào hồ sơ dự thi.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
          <iframe
            ref={frameRef}
            title="Tạo nhân vật 3D"
            src={RPM_URL}
            allow="camera *; microphone *; clipboard-write"
            className="h-[26rem] w-full rounded-xl border border-border"
          />
          <div className="rounded-xl border border-border bg-secondary/40 p-2">
            {preview ? (
              <Suspense fallback={<div className="grid h-64 place-items-center"><Loader2 className="size-5 animate-spin" /></div>}>
                <AvatarView3D url={preview} className="h-64 w-full" />
              </Suspense>
            ) : (
              <p className="type-meta grid h-64 place-items-center text-center">Xem trước nhân vật hiển thị ở đây.</p>
            )}
            {save.isPending ? (
              <p className="type-meta mt-2 inline-flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" /> Đang lưu…
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
