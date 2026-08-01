import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { readExamEntry } from "@/lib/examSession";
import { getDueCount } from "@/lib/tower.functions";
import { cachedFetch } from "@/lib/cache/ttlCache";

/**
 * Huy hiệu "N thẻ cần ôn" — chỉ hiển thị khi máy đã có thông tin thí sinh.
 * Gọi đúng MỘT lần khi mở sảnh, không thăm dò, không realtime.
 */
export function DueBadge({ className }: { className?: string }) {
  const fetchDue = useServerFn(getDueCount);
  const [due, setDue] = useState<number | null>(null);

  useEffect(() => {
    const entry = typeof window === "undefined" ? null : readExamEntry(window.sessionStorage);
    if (!entry) return;
    let alive = true;
    // Lịch ôn thay đổi chậm: dùng lại kết quả trong 10 phút, chỉ gọi khi cache cũ.
    void cachedFetch(`vatm:due:${entry.credential}`, 10 * 60_000, () =>
      fetchDue({
        data: {
          name: entry.name,
          credential: entry.credential,
          ...(entry.extraCredential ? { extraCredential: entry.extraCredential } : {}),
        },
      }),
    )
      .then((res) => {
        if (alive) setDue(res.due);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [fetchDue]);

  if (!due) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={
            "inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary " +
            (className ?? "")
          }
        >
          <CalendarClock className="size-3" />
          {due} thẻ cần ôn
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Số câu đã đến hạn ôn lại theo lịch lặp lại ngắt quãng của riêng bạn.
      </TooltipContent>
    </Tooltip>
  );
}
