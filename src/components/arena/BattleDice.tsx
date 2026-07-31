import { Dices } from "lucide-react";

/** Màn tung xúc xắc ngắn để người chơi nhìn rõ sát thương gốc trước khi sang câu mới. */
export function BattleDice({ dice }: { dice: number[] }) {
  if (dice.length !== 2) return null;
  const total = dice[0] + dice[1];
  return (
    <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-background/35 backdrop-blur-[2px]">
      <div className="animate-dice-stage flex flex-col items-center gap-3" role="status" aria-live="assertive">
        <Dices className="size-8 text-primary" />
        <div className="flex gap-4">
          {dice.map((value, index) => (
            <span
              key={`${index}-${value}`}
              className="animate-dice-roll grid size-20 place-items-center rounded-xl border-2 border-primary/30 bg-card text-4xl font-black text-primary shadow-[var(--shadow-lift)]"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              {value}
            </span>
          ))}
        </div>
        <p className="rounded-full bg-card px-4 py-2 font-mono text-lg font-black shadow-[var(--shadow-soft)]">
          {dice[0]} + {dice[1]} = {total}
        </p>
      </div>
    </div>
  );
}