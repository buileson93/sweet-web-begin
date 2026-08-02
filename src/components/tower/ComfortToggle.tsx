/**
 * Tuỳ chọn thân thiện cho mọi lứa tuổi: cỡ chữ lớn và giảm chuyển động.
 * Lưu tại máy, áp thẳng lên thẻ <html> nên có hiệu lực cho toàn trang.
 */
import { useCallback, useEffect, useState } from "react";
import { Accessibility, Sparkles, Type } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const KEY = "vatm:tower:comfort";

export type Comfort = { largeText: boolean; calm: boolean };
const DEFAULT_COMFORT: Comfort = { largeText: false, calm: false };

export function readComfort(): Comfort {
  if (typeof window === "undefined") return DEFAULT_COMFORT;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_COMFORT, ...(JSON.parse(raw) as Partial<Comfort>) } : DEFAULT_COMFORT;
  } catch {
    return DEFAULT_COMFORT;
  }
}

function apply(c: Comfort) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("twr-large-text", c.largeText);
  document.documentElement.classList.toggle("twr-calm", c.calm);
}

/** Nút bánh răng trợ năng — đặt cạnh túi đồ trong thanh trạng thái. */
export function ComfortToggle() {
  const [comfort, setComfort] = useState<Comfort>(DEFAULT_COMFORT);

  useEffect(() => {
    const saved = readComfort();
    setComfort(saved);
    apply(saved);
  }, []);

  const update = useCallback((patch: Partial<Comfort>) => {
    setComfort((prev) => {
      const next = { ...prev, ...patch };
      apply(next);
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* không lưu được thì chỉ áp dụng cho phiên này */
      }
      return next;
    });
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" aria-label="Tuỳ chọn hiển thị thân thiện">
          <Accessibility className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-sm font-semibold">Hiển thị thân thiện</p>
        <div className="flex items-start justify-between gap-3">
          <Label htmlFor="twr-large-text" className="flex-1 cursor-pointer text-sm font-medium">
            <span className="flex items-center gap-1.5">
              <Type className="size-3.5" /> Cỡ chữ lớn
            </span>
            <span className="type-meta block font-normal">Tăng cỡ chữ toàn trang cho dễ đọc.</span>
          </Label>
          <Switch
            id="twr-large-text"
            checked={comfort.largeText}
            onCheckedChange={(v) => update({ largeText: v })}
          />
        </div>
        <div className="flex items-start justify-between gap-3">
          <Label htmlFor="twr-calm" className="flex-1 cursor-pointer text-sm font-medium">
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5" /> Giảm chuyển động
            </span>
            <span className="type-meta block font-normal">Tắt hiệu ứng lật bài, nhấp nháy — mượt hơn trên điện thoại.</span>
          </Label>
          <Switch id="twr-calm" checked={comfort.calm} onCheckedChange={(v) => update({ calm: v })} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
