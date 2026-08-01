import { useEffect, useState } from "react";
import { AlertTriangle, Coins, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { curseById } from "@/lib/tower/curses";
import { cn } from "@/lib/utils";

const RANK_LABEL: Record<number, { text: string; tone: string }> = {
  1: { text: "Rủi ro nhẹ", tone: "text-amber-600 border-amber-500/40 bg-amber-500/10" },
  2: { text: "Rủi ro vừa", tone: "text-orange-600 border-orange-500/40 bg-orange-500/10" },
  3: { text: "Rủi ro nặng", tone: "text-destructive border-destructive/40 bg-destructive/10" },
};

/** Hậu quả nói thẳng, không vòng vo — người chơi phải thấy rõ cái giá. */
const CONSEQUENCE: Record<string, string> = {
  "mu-suong": "Mỗi câu mất 1/4 thời gian: câu dài rất dễ hết giờ.",
  "xieng-xich": "Kỹ năng hồi chậm 3 lượt: mất phao ở đúng tầng sự cố lớn.",
  "vet-thuong-ho": "Phòng nghỉ ca và trang bị hồi an toàn thành vô nghĩa suốt hành trình.",
  "long-tham": "Mỗi câu sai đau hơn 20%, nhưng tín chỉ nhặt được nhiều hơn 60%.",
  "im-lang": "Mất hẳn một kỹ năng ngẫu nhiên cho tới cuối hành trình.",
};

type Props = {
  curseId: string;
  coins: number;
  onAccept: () => void;
  onDecline: () => void;
};

/** Yếu tố bất lợi — lá bài úp màu đỏ, lật ra là thấy ngay mức rủi ro và cái được. */
export function CurseOffer({ curseId, coins, onAccept, onDecline }: Props) {
  const curse = curseById(curseId);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
    const t = window.setTimeout(() => setOpen(true), 260);
    return () => window.clearTimeout(t);
  }, [curseId]);

  if (!curse) return null;
  const rank = RANK_LABEL[curse.rank] ?? RANK_LABEL[1]!;

  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", rank.tone)}>
          {rank.text} · bậc {curse.rank}
        </span>
        <span className="type-meta">Nhận rủi ro để đổi lấy phần thưởng — hoàn toàn tự nguyện.</span>
      </div>

      <div className={cn("tower-card mt-3 h-36 w-full max-w-xs", open && "is-open")}>
        <span className="tower-card__inner">
          <span className="tower-card__face tower-card__back tower-card__back--curse">
            <span className="text-2xl">🃏</span>
            <span className="type-meta mt-1">Đang lật yếu tố bất lợi…</span>
          </span>
          <span className="tower-card__face tower-card__front border-destructive/50 bg-gradient-to-b from-destructive/25 to-destructive/5 p-3">
            <span className="text-2xl">{curse.icon}</span>
            <span className="mt-1 text-sm font-bold">{curse.name}</span>
            <span className="type-meta mt-0.5">{curse.desc}</span>
            <span className="mt-auto flex items-start gap-1 text-left text-[11px] leading-snug text-destructive">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              {CONSEQUENCE[curse.id] ?? "Ảnh hưởng kéo dài tới hết hành trình."}
            </span>
          </span>
        </span>
      </div>

      <p className="type-meta mt-2">
        Đổi lại: <strong className="text-amber-600">+{coins} tín chỉ</strong> và +{curse.rank * 30} điểm hành trình khi kết
        thúc. Yếu tố bất lợi không thể tự gỡ, chỉ kho khí tài mới hoá giải được.
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="destructive" onClick={onAccept}>
          <Coins className="mr-1.5 size-3.5" /> Chấp nhận rủi ro
        </Button>
        <Button size="sm" variant="outline" onClick={onDecline}>
          <ShieldOff className="mr-1.5 size-3.5" /> Đi đường an toàn
        </Button>
      </div>
    </div>
  );
}
