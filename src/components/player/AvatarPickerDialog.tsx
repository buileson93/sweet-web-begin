import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Shuffle, UserRoundCog } from "lucide-react";
import { toast } from "sonner";

import { Avatar2D } from "@/components/player/Avatar2D";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AVATAR_BACKGROUNDS,
  AVATAR_STYLES,
  decodeAvatar,
  encodeAvatar,
  optionGroups,
  optionValueLabel,
  suggestSeeds,
  type AvatarOptions,
  type AvatarStyleId,
} from "@/lib/avatar2d";
import { savePlayerAvatar, type PlayerProfile } from "@/lib/player.functions";
import { cn } from "@/lib/utils";


/**
 * Chọn nhân vật 2D (SVG dựng tại chỗ) rồi lưu vào hồ sơ người chơi.
 * Cần xác thực lại bằng danh bạ để không ai đổi được avatar của người khác.
 */
export function AvatarPickerDialog({
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
  const initial = useMemo(() => decodeAvatar(currentUrl, name || "VATM"), [currentUrl, name]);
  const [style, setStyle] = useState<AvatarStyleId>(initial.style);
  const [seed, setSeed] = useState(initial.seed);
  const [background, setBackground] = useState(initial.background);
  const seeds = useMemo(() => suggestSeeds(name || "VATM", 12), [name]);
  const spec = { style, seed, background };
  const runSave = useServerFn(savePlayerAvatar);

  const save = useMutation({
    mutationFn: () => runSave({ data: { name, credential, avatarUrl: encodeAvatar(spec), avatarImage: "" } }),
    onSuccess: (profile) => {
      toast.success("Đã lưu nhân vật của bạn");
      onSaved?.(profile);
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Không lưu được nhân vật"),
  });

  // Mở lại hộp thoại thì quay về đúng nhân vật đang dùng, không giữ lựa chọn dở dang.
  function handleOpenChange(next: boolean) {
    if (next) {
      setStyle(initial.style);
      setSeed(initial.seed);
      setBackground(initial.background);
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="rounded-full">
          <UserRoundCog className="size-4" />
          {currentUrl ? "Đổi nhân vật" : "Chọn nhân vật"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nhân vật của bạn</DialogTitle>
          <DialogDescription>Chọn phong cách, gương mặt và màu nền — xem trước ngay bên trái.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-2">
            <span className="size-32 overflow-hidden rounded-full ring-4 ring-primary/25">
              <Avatar2D spec={spec} name={name} className="size-full" />
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={() => setSeed(`${name || "VATM"}-${Math.random().toString(36).slice(2, 7)}`)}
            >
              <Shuffle className="size-4" /> Ngẫu nhiên
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {AVATAR_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyle(s.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition",
                    style === s.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary/50 hover:bg-secondary",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-6 gap-2">
              {seeds.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-label={`Gương mặt ${s}`}
                  onClick={() => setSeed(s)}
                  className={cn(
                    "aspect-square overflow-hidden rounded-full ring-2 transition hover:scale-105",
                    seed === s ? "ring-primary" : "ring-border",
                  )}
                >
                  <Avatar2D spec={{ style, seed: s, background }} name={name} className="size-full" />
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {AVATAR_BACKGROUNDS.map((bg) => (
                <button
                  key={bg}
                  type="button"
                  aria-label={`Màu nền ${bg}`}
                  onClick={() => setBackground(bg)}
                  style={{ backgroundColor: `#${bg}` }}
                  className={cn(
                    "grid size-7 place-items-center rounded-full ring-2 transition",
                    background === bg ? "ring-primary" : "ring-border",
                  )}
                >
                  {background === bg ? (
                    <Check className="size-3.5 text-white [filter:drop-shadow(0_0_1px_rgba(0,0,0,0.9))]" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
            Huỷ
          </Button>
          <Button
            type="button"
            className="rounded-full"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Lưu nhân vật
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
