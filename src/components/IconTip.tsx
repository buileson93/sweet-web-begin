import { useState, type ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  /** Nội dung mô tả hiển thị khi rê chuột hoặc chạm. */
  label: string;
  children: ReactNode;
  className?: string;
};

/**
 * Bọc một biểu tượng bất kỳ bằng tooltip mô tả, dùng được cả trên cảm ứng
 * (chạm để mở, chạm lại để đóng) — thay cho các dòng chữ giải thích dài.
 */
export function IconTip({ label, children, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className={cn("shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", className)}
            onClick={() => setOpen((v) => !v)}
            onBlur={() => setOpen(false)}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[14rem] leading-relaxed">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
