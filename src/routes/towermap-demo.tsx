import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { TowerMap } from "@/components/tower/TowerMap";
import { buildMap } from "@/lib/tower/map";

export const Route = createFileRoute("/towermap-demo")({ component: Demo });

function Demo() {
  const map = buildMap("demo-seed");
  const [floor, setFloor] = useState(5);
  return (
    <div className="mx-auto max-w-md p-4">
      <button type="button" onClick={() => setFloor((f) => f + 1)}>
        Tầng {floor}
      </button>
      <TowerMap map={map} floor={floor} path={["combat", "shop", "campfire", "boss"]} canPick onPick={() => {}} />
    </div>
  );
}
