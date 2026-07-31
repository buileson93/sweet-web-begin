import { useCallback, useState } from "react";
import { Copy, Facebook, Link2, Loader2, MessageCircle, QrCode, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BusyDuelDialog } from "@/components/arena/BusyDuelDialog";
import { arenaCreateRoom, arenaEndActive } from "@/lib/arena.functions";
import { parseBusyError, type BusyInfo } from "@/lib/arena/rooms";
import { getDeviceId } from "@/lib/deviceId";

/**
 * Tạo phòng chờ và chia sẻ link thách đấu qua mạng xã hội.
 * Người nhận chỉ cần đăng nhập nhanh là vào thẳng phòng.
 */
export function ShareChallenge({ token, quizId }: { token: string; quizId?: string | null }) {
  const createRoom = useServerFn(arenaCreateRoom);
  const endActive = useServerFn(arenaEndActive);
  const [busyDuel, setBusyDuel] = useState<BusyInfo | null>(null);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");

  const make = useCallback(async () => {
    setBusy(true);
    try {
      const res = await createRoom({ data: { token, quizId: quizId ?? null, deviceHash: getDeviceId() } });
      const link = `${window.location.origin}/dau-truong/${res.duelId}`;
      setUrl(link);
      const QR = await import("qrcode");
      setQr(await QR.toDataURL(link, { margin: 1, width: 220 }));
      if (navigator.share) {
        await navigator
          .share({ title: "Thách đấu VATM", text: "Vào so tài với tôi nào!", url: link })
          .catch(() => undefined);
      } else {
        await navigator.clipboard.writeText(link).catch(() => undefined);
        toast.success(
          res.reused
            ? "Bạn đã có sẵn phòng chờ — link đã được sao chép lại."
            : "Đã sao chép link thách đấu",
        );
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Không tạo được phòng mời";
      const info = parseBusyError(raw);
      if (info) setBusyDuel(info);
      else toast.error(raw);
    } finally {
      setBusy(false);
    }
  }, [createRoom, quizId, token]);

  const shares = url
    ? [
        {
          key: "zalo",
          label: "Gửi qua Zalo",
          icon: MessageCircle,
          href: `https://zalo.me/share?u=${encodeURIComponent(url)}`,
        },
        {
          key: "facebook",
          label: "Gửi qua Facebook",
          icon: Facebook,
          href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        },
      ]
    : [];

  return (
    <section className="rounded-2xl border bg-card/80 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Link2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Link thách đấu</p>
          <p className="text-xs text-muted-foreground">
            Tạo phòng chờ và gửi link cho đồng nghiệp qua mạng xã hội.
          </p>
        </div>
        <Button className="rounded-full" disabled={busy} onClick={() => void make()}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Share2 className="mr-2 size-4" />}
          Tạo link mời
        </Button>
      </div>

      {url ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
              <code className="min-w-0 flex-1 truncate text-xs">{url}</code>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Sao chép link"
                    onClick={() => {
                      void navigator.clipboard.writeText(url);
                      toast.success("Đã sao chép");
                    }}
                  >
                    <Copy className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sao chép link</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {shares.map((s) => (
                <Tooltip key={s.key}>
                  <TooltipTrigger asChild>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={s.label}
                      className="inline-grid size-9 place-items-center rounded-full border bg-background text-primary transition hover:scale-110 hover:bg-primary/10"
                    >
                      <s.icon className="size-4" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>{s.label}</TooltipContent>
                </Tooltip>
              ))}
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => void navigate({ to: "/dau-truong/$duelId", params: { duelId: url.split("/").pop()! } })}
              >
                Vào phòng chờ
              </Button>
            </div>
          </div>
          {qr ? (
            <figure className="justify-self-center rounded-xl border bg-background p-2">
              <img src={qr} alt="Mã QR link thách đấu" className="size-28" />
              <figcaption className="mt-1 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                <QrCode className="size-3" /> Quét để vào
              </figcaption>
            </figure>
          ) : null}
        </div>
      ) : null}

      <BusyDuelDialog
        busy={busyDuel}
        onClose={() => setBusyDuel(null)}
        onLeave={() => endActive({ data: { token } })}
        onLeft={() => void make()}
      />
    </section>
  );
}

export default ShareChallenge;
