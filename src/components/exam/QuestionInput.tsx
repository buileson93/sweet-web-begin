import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { questionImageSrc } from "@/lib/questionImage";
import { Button } from "@/components/ui/button";
import type { AnswerValue, QuestionKind } from "@/lib/questionKinds";
import { buildCloak } from "@/lib/exam/optionCloak";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { behaviorTracker } from "@/lib/exam/behavior";

export type QuestionInputProps = {
  kind: QuestionKind;
  options: string[];
  /** Ảnh riêng của từng phương án, cùng chỉ số với `options` (rỗng = không có). */
  optionImages?: string[];
  matchLeft: string[];
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  /** Các phương án bị loại bởi trợ giúp 50:50. */
  removed?: number[];
  disabled?: boolean;
  /** Phản hồi tức thì: đáp án đã chốt đúng hay sai. */
  feedback?: "correct" | "wrong" | null;
  /** Có bấm trúng thẻ mồi ẩn (chỉ script quét DOM mới làm được). */
  onTrap?: (info: { token: string }) => void;
};

const LETTER = (i: number) => String.fromCharCode(65 + i);

/** Khung chọn đáp án dùng chung cho mọi loại câu hỏi. */
export function QuestionInput({
  kind,
  options,
  optionImages = [],
  matchLeft,
  value,
  onChange,
  removed = [],
  disabled,
  feedback = null,
  onTrap,
}: QuestionInputProps) {
  const [zoom, setZoom] = useState<string | null>(null);

  if (kind === "fill_blank") {
    return (
      <div className="mt-4">
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Nhập đáp án của bạn..."
          aria-label="Đáp án"
          className="h-12 rounded-xl text-base"
        />
        <p className="type-meta mt-2">Không phân biệt chữ hoa/thường và dấu.</p>
      </div>
    );
  }

  if (kind === "matching") {
    const map = (typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<
      string,
      number
    >;
    return (
      <div className="stagger mt-4 space-y-2">
        {matchLeft.map((left, i) => (
          <div
            key={i}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-2 rounded-xl border border-border bg-card p-2.5"
          >
            <span className="min-w-0 text-sm font-semibold">{left}</span>
            <select
              disabled={disabled}
              value={map[String(i)] ?? ""}
              onChange={(e) => onChange({ ...map, [String(i)]: Number(e.target.value) })}
              aria-label={`Chọn mục nối với ${left}`}
              className="h-10 w-full min-w-0 truncate rounded-lg border border-border bg-background px-2 text-sm"
            >
              <option value="">— chọn —</option>
              {options.map((opt, j) => (
                <option key={j} value={j}>
                  {LETTER(j)}. {opt}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  }

  if (kind === "ordering") {
    const order =
      Array.isArray(value) && value.length === options.length
        ? (value as number[])
        : options.map((_, i) => i);
    const move = (pos: number, dir: -1 | 1) => {
      const next = [...order];
      const target = pos + dir;
      if (target < 0 || target >= next.length) return;
      [next[pos], next[target]] = [next[target], next[pos]];
      onChange(next);
    };
    return (
      <div className="stagger mt-4 space-y-2">
        {order.map((optIndex, pos) => (
          <div
            key={optIndex}
            className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-extrabold">
              {pos + 1}
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <RichText inline>{options[optIndex]}</RichText>
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              disabled={disabled || pos === 0}
              onClick={() => move(pos, -1)}
              aria-label="Lên trên"
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              disabled={disabled || pos === order.length - 1}
              onClick={() => move(pos, 1)}
              aria-label="Xuống dưới"
            >
              <ArrowDown className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    );
  }

  const multi = kind === "multi";
  const selected = multi
    ? new Set(Array.isArray(value) ? (value as number[]) : [])
    : new Set(typeof value === "number" ? [value] : []);

  const toggle = (i: number, event?: React.MouseEvent | React.TouchEvent) => {
    if (event) {
      behaviorTracker.click(
        "clientX" in event ? event : (event as React.TouchEvent).touches[0]!,
        event.currentTarget as HTMLElement
      );
    }
    if (!multi) return onChange(i);
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    onChange([...next].sort((a, b) => a - b));
  };

  const hasImages = optionImages.some(Boolean);

  // Biến đổi ngẫu nhiên: token dùng một lần + tráo thứ tự DOM + chèn thẻ mồi.
  // Thứ tự NHÌN THẤY vẫn giữ nguyên nhờ CSS `order`.
  const cloak = useMemo(() => buildCloak(options), [options]);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      const p = "clientX" in e ? e : (e as TouchEvent).touches[0]!;
      behaviorTracker.move(p.clientX, p.clientY);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
    };
  }, []);

  return (
    <div
      className={cn(
        "stagger relative mt-5",
        hasImages ? "grid grid-cols-2 gap-2.5 sm:grid-cols-2" : "flex flex-col gap-2.5",
      )}
    >
      {multi ? (
        <p className={cn("type-meta", hasImages && "col-span-2")}>Có thể chọn nhiều phương án.</p>
      ) : null}
      {cloak.slots.map((slot) => {
        if (slot.kind === "trap") {
          // Thẻ mồi: 1px, trong suốt, không nhận sự kiện chuột, ẩn với trình đọc màn hình
          // => thí sinh thật KHÔNG THỂ bấm; script quét DOM sẽ bấm và tự lộ diện.
          return (
            <button
              key={slot.key}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              data-opt={slot.token}
              style={{ order: slot.visual, opacity: 0.0001, zIndex: -10 }}
              className="pointer-events-none absolute size-px overflow-hidden"
              onClick={() => onTrap?.({ token: slot.token })}
            >
              {slot.text}
            </button>
          );
        }
        const i = slot.index;
        const opt = slot.text;
        const isRemoved = removed.includes(i);
        const active = selected.has(i);
        const state = active && feedback ? feedback : null;
        return (
          <button
            key={slot.key}
            type="button"
            data-opt={slot.token}
            style={{ order: slot.visual }}
            disabled={disabled || isRemoved}
            onClick={(e) => toggle(i, e)}
            className={cn(
              "group relative flex w-full overflow-hidden rounded-2xl border-2 p-3.5 text-left transition-all duration-200 sm:p-4",
              hasImages ? "flex-col items-start gap-2" : "items-center gap-3",
              state === "correct"
                ? "border-success bg-success/12"
                : state === "wrong"
                  ? "border-destructive bg-destructive/12"
                  : active
                    ? "animate-tap-shake border-primary bg-primary/10 shadow-[var(--shadow-ring)]"
                    : "border-border bg-card hover:-translate-y-0.5 hover:border-accent/60 hover:bg-secondary active:scale-[0.99]",
              isRemoved && "pointer-events-none opacity-35 line-through",
              disabled && !active && "opacity-60",
            )}
          >
            <span
              className={cn(
                "relative z-10 grid size-9 shrink-0 place-items-center text-sm font-extrabold transition-colors",
                multi ? "rounded-lg" : "rounded-xl",
                state === "correct"
                  ? "bg-success text-primary-foreground"
                  : state === "wrong"
                    ? "bg-destructive text-destructive-foreground"
                    : active
                      ? "surface-gold"
                      : "bg-secondary text-secondary-foreground",
              )}
            >
              {state === "correct" ? (
                <Check className="size-4" />
              ) : state === "wrong" ? (
                <X className="size-4" />
              ) : active && multi ? (
                <Check className="size-4" />
              ) : (
                LETTER(i)
              )}
            </span>
            {hasImages && questionImageSrc(optionImages[i] || null) ? (
              <span
                role="button"
                tabIndex={0}
                aria-label={`Phóng to ảnh phương án ${LETTER(i)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setZoom(questionImageSrc(optionImages[i] || null));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    setZoom(questionImageSrc(optionImages[i] || null));
                  }
                }}
                className="relative z-10 block w-full overflow-hidden rounded-xl border border-border bg-secondary"
              >
                <img
                  src={questionImageSrc(optionImages[i] || null)!}
                  alt={`Ảnh phương án ${LETTER(i)}`}
                  loading="lazy"
                  className="h-28 w-full object-contain sm:h-36"
                />
              </span>
            ) : null}
            <span className="relative z-10 min-w-0 flex-1 text-[0.95rem] font-medium leading-snug">
              <RichText inline>{opt}</RichText>
            </span>
            {active && !feedback ? (
              <>
                <span className="pointer-events-none absolute inset-0 z-0 animate-answer-ping rounded-2xl bg-primary/15" />
                <span className="tap-flash z-0 rounded-2xl" aria-hidden />
              </>
            ) : null}
          </button>
        );
      })}

      {zoom ? (
        <div
          role="dialog"
          aria-label="Ảnh phương án phóng to"
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-[100] grid place-items-center bg-background/90 p-4 backdrop-blur-sm"
        >
          <img src={zoom} alt="Ảnh phương án phóng to" className="max-h-[85vh] max-w-full rounded-2xl" />
          <p className="type-meta mt-3">Chạm vào bất kỳ đâu để đóng</p>
        </div>
      ) : null}
    </div>
  );
}
