import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Compass, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export type TourStep = {
  /** Giá trị của thuộc tính data-tour trên phần tử cần giới thiệu */
  target: string;
  title: string;
  description: string;
};

const STORAGE_KEY = "tour:seen:v1";
const HIGHLIGHT_CLASS = "tour-highlight";

/**
 * Product tour gọn nhẹ: tô sáng lần lượt các khu vực chính bằng thuộc tính
 * data-tour, không dùng thêm thư viện, tôn trọng prefers-reduced-motion.
 */
export function ProductTour({ steps, storageKey = STORAGE_KEY }: { steps: TourStep[]; storageKey?: string }) {
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(storageKey)) return;
    const t = setTimeout(() => setIndex(0), 900);
    return () => clearTimeout(t);
  }, [storageKey]);

  useEffect(() => {
    const handler = () => setIndex(0);
    window.addEventListener("start-product-tour", handler);
    return () => window.removeEventListener("start-product-tour", handler);
  }, []);

  const stop = useCallback(() => {
    setIndex(null);
    if (typeof window !== "undefined") localStorage.setItem(storageKey, "1");
  }, [storageKey]);

  useEffect(() => {
    if (index === null) return;
    const step = steps[index];
    const el = document.querySelector<HTMLElement>(`[data-tour="${step?.target}"]`);
    if (!el) return;
    el.classList.add(HIGHLIGHT_CLASS);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    return () => el.classList.remove(HIGHLIGHT_CLASS);
  }, [index, steps]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, stop]);

  if (index === null || !steps[index]) return null;
  const step = steps[index];
  const last = index === steps.length - 1;

  return (
    <div
      role="dialog"
      aria-label="Hướng dẫn nhanh"
      className="card-elevated fixed bottom-4 left-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl p-4 shadow-[var(--shadow-lift)] sm:left-auto sm:right-6 sm:translate-x-0"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
          <Compass className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="type-eyebrow text-muted-foreground">
            Bước {index + 1}/{steps.length}
          </p>
          <p className="mt-0.5 font-semibold">{step.title}</p>
          <p className="type-muted mt-1">{step.description}</p>
        </div>
        <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-full" aria-label="Đóng hướng dẫn" onClick={stop}>
          <X className="size-4" />
        </Button>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="rounded-full" onClick={stop}>
          Bỏ qua
        </Button>
        <Button size="sm" className="rounded-full" onClick={() => (last ? stop() : setIndex((i) => (i ?? 0) + 1))}>
          {last ? "Bắt đầu thôi" : "Tiếp tục"}
          {!last && <ArrowRight className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
