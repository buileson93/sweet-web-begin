import { useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";

import { PALETTES, applyPalette, readPalette, type PaletteId } from "@/lib/palette";
import { cn } from "@/lib/utils";

/** Bộ chọn bảng màu cho quản trị viên. */
export function PaletteSwitcher({ className }: { className?: string }) {
  const [active, setActive] = useState<PaletteId>("aviation");

  useEffect(() => {
    setActive(readPalette());
  }, []);

  return (
    <div className={cn("rounded-3xl border border-border bg-card p-5", className)}>
      <h3 className="type-h3 flex items-center gap-2">
        <Palette className="size-4 text-accent" /> xem Phan Thành An có gian lận ko
      </h3>
      <p className="type-meta mt-1">Áp dụng ngay cho toàn bộ giao diện trên thiết bị này.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {PALETTES.map((p) => {
          const selected = p.id === active;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                applyPalette(p.id);
                setActive(p.id);
              }}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5",
                selected ? "border-primary bg-secondary shadow-[var(--shadow-soft)]" : "border-border bg-background",
              )}
            >
              <span className="flex shrink-0 -space-x-1.5">
                {p.swatch.map((c) => (
                  <span
                    key={c}
                    className="size-6 rounded-full border-2 border-card"
                    style={{ backgroundColor: c }}
                    aria-hidden
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{p.label}</span>
              {selected && <Check className="size-4 shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
