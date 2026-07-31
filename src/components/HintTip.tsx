import { useEffect, useState, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  /** Nội dung hướng dẫn hiển thị khi rê chuột (desktop) hoặc chạm (cảm ứng). */
  children: ReactNode;
  label?: string;
  className?: string;
};

/**
 * Hướng dẫn dạng tooltip dùng được trên mọi thiết bị:
 * - Máy tính: rê chuột hoặc focus bàn phím để mở.
 * - Cảm ứng: chạm để mở, chạm lại (hoặc ra ngoài) để đóng.
 */
export function HintTip({ children, label = "Xem hướng dẫn", className }: Props) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!pinned) return;
    const close = () => {
      setPinned(false);
      setOpen(false);
    };
    window.addEventListener("scroll", close, { passive: true });
    return () => window.removeEventListener("scroll", close);
  }, [pinned]);

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip
        open={open}
        onOpenChange={(v) => {
          if (pinned && !v) return; // giữ mở khi người dùng đã chạm để ghim
          setOpen(v);
        }}
      >
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            aria-expanded={open}
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:size-5",
              open && "bg-secondary text-foreground",
              className,
            )}
            onClick={() => {
              const next = !pinned;
              setPinned(next);
              setOpen(next);
            }}
            onBlur={() => {
              setPinned(false);
              setOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setPinned(false);
                setOpen(false);
              }
            }}
          >
            <HelpCircle className="size-4 md:size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="max-w-[16rem] leading-relaxed"
          onPointerDownOutside={() => {
            setPinned(false);
            setOpen(false);
          }}
        >
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
