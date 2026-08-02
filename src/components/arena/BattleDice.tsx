import { useEffect, useMemo, useState } from "react";

/** Vị trí chấm của từng mặt xúc xắc (lưới 3x3). */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** Xoay khối lập phương để mặt cần xem quay ra trước. */
const FACE_ROT: Record<number, string> = {
  1: "rotateX(0deg) rotateY(0deg)",
  2: "rotateY(-90deg)",
  3: "rotateY(180deg)",
  4: "rotateY(90deg)",
  5: "rotateX(-90deg)",
  6: "rotateX(90deg)",
};

const FACES: { value: number; transform: string }[] = [
  { value: 1, transform: "translateZ(28px)" },
  { value: 2, transform: "rotateY(90deg) translateZ(28px)" },
  { value: 3, transform: "rotateY(180deg) translateZ(28px)" },
  { value: 4, transform: "rotateY(-90deg) translateZ(28px)" },
  { value: 5, transform: "rotateX(90deg) translateZ(28px)" },
  { value: 6, transform: "rotateX(-90deg) translateZ(28px)" },
];

function Face({ value }: { value: number }) {
  const pips = PIPS[value] ?? [];
  return (
    <div className="dice-face">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={pips.includes(i) ? "dice-pip" : "dice-pip-off"} />
      ))}
    </div>
  );
}

function Cube({ value, rollMs }: { value: number; rollMs: number }) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const id = window.setTimeout(() => setSettled(true), rollMs);
    return () => window.clearTimeout(id);
  }, [value, rollMs]);
  return (
    <div className="dice-scene">
      <div
        className={settled ? "dice-cube dice-cube-settle" : "dice-cube dice-cube-rolling"}
        style={settled ? { transform: FACE_ROT[value] ?? FACE_ROT[1] } : undefined}
      >
        {FACES.map((f) => (
          <div key={f.value} className="dice-face-wrap" style={{ transform: f.transform }}>
            <Face value={f.value} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Màn tung xúc xắc: KHÔNG làm mờ màn hình để vẫn nhìn rõ animation chiến đấu.
 * Thời gian lăn của mỗi viên được random nhẹ để tạo cảm giác hồi hộp.
 */
export function BattleDice({ dice }: { dice: number[] }) {
  // Random một lần cho mỗi lượt tung (đổi khi bộ số đổi).
  const rolls = useMemo(
    () => dice.map((_, i) => 650 + Math.round(Math.random() * 500) + i * 260),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dice.join("-")],
  );
  const settleAt = rolls.length ? Math.max(...rolls) : 0;
  const [showTotal, setShowTotal] = useState(false);
  useEffect(() => {
    if (dice.length !== 2) return;
    setShowTotal(false);
    const id = window.setTimeout(() => setShowTotal(true), settleAt + 120);
    return () => window.clearTimeout(id);
  }, [dice, settleAt]);

  if (dice.length !== 2) return null;
  const total = dice[0] + dice[1];

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] z-40 grid place-items-center">
      <div
        className="animate-dice-stage flex items-center gap-4 rounded-2xl border border-primary/25 bg-card/80 px-4 py-3 shadow-[var(--shadow-lift)] backdrop-blur-sm"
        role="status"
        aria-live="assertive"
      >
        {dice.map((value, index) => (
          <Cube key={index} value={value} rollMs={rolls[index]} />
        ))}
        <p
          className={
            "font-mono text-base font-black transition-all duration-300 " +
            (showTotal ? "scale-100 opacity-100" : "scale-90 opacity-0")
          }
        >
          = {total}
        </p>
      </div>
    </div>
  );
}
