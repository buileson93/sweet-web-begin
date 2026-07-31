import { useEffect, useState } from "react";
import { Frown, ThumbsUp } from "lucide-react";

/**
 * Hiệu ứng phản hồi tức thì:
 * - Đúng: một chùm nút "like" bay lên.
 * - Sai: biểu tượng mặt buồn rơi xuống và lắc nhẹ.
 */
export function AnswerFx({ event }: { event: { id: number; correct: boolean } | null }) {
  const [shown, setShown] = useState<{ id: number; correct: boolean } | null>(null);

  useEffect(() => {
    if (!event) return;
    setShown(event);
    const timer = window.setTimeout(() => setShown(null), event.correct ? 1600 : 1800);
    return () => window.clearTimeout(timer);
  }, [event]);

  if (!shown) return null;

  if (!shown.correct) {
    return (
      <div
        key={shown.id}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-40 grid place-items-center"
      >
        <span className="animate-fx-sad grid size-24 place-items-center rounded-full bg-destructive/15 text-destructive backdrop-blur-[1px]">
          <Frown className="size-14" strokeWidth={2.2} />
        </span>
      </div>
    );
  }

  const likes = [0, 1, 2, 3, 4, 5];
  return (
    <div key={shown.id} aria-hidden className="pointer-events-none fixed inset-0 z-40">
      {likes.map((i) => (
        <span
          key={i}
          className="animate-fx-like absolute bottom-24 text-success"
          style={{
            left: `${18 + i * 12}%`,
            animationDelay: `${i * 90}ms`,
            fontSize: `${18 + (i % 3) * 8}px`,
          }}
        >
          <ThumbsUp className="size-[1em]" strokeWidth={2.4} />
        </span>
      ))}
    </div>
  );
}
