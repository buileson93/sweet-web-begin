import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Html, RoundedBox, useGLTF } from "@react-three/drei";
import type { Group } from "three";

export type PodiumPlayer = {
  employeeId: string;
  displayName: string;
  unit: string;
  level: number;
  xp: number;
  examsPassed: number;
  avatarUrl: string;
  avatarImage: string;
};

/** Màu hạng: vàng – bạc – đồng, hài hoà với tông công sở. */
const RANK_COLOR = ["#e8b45a", "#b8c2cf", "#c98a5e"];
const RANK_LABEL = ["Hạng 1", "Hạng 2", "Hạng 3"];

/** Nhân vật GLB (Ready Player Me). */
function GlbFigure({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={clone} scale={1.15} position={[0, 0, 0]} />;
}

/** Nhân vật tượng trưng khi nhân viên chưa tạo mô hình 3D. */
function PlaceholderFigure({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 1.28, 0]} castShadow>
        <sphereGeometry args={[0.2, 32, 32]} />
        <meshStandardMaterial color="#f0d9c4" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.52, 8, 24]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.9, 0.19]} rotation={[0.1, 0, 0]}>
        <boxGeometry args={[0.1, 0.42, 0.03]} />
        <meshStandardMaterial color="#f7f7f7" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Podium({
  player,
  rank,
  x,
  height,
  onSelect,
}: {
  player: PodiumPlayer;
  rank: number;
  x: number;
  height: number;
  onSelect?: (p: PodiumPlayer) => void;
}) {
  const group = useRef<Group>(null);
  const [hover, setHover] = useState(false);
  const color = RANK_COLOR[rank] ?? RANK_COLOR[2];

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const targetY = height + (hover ? 0.16 : 0);
    g.position.y += (targetY - g.position.y) * Math.min(1, delta * 8);
    const spin = hover ? Math.sin(state.clock.elapsedTime * 1.2) * 0.35 : 0;
    g.rotation.y += (spin - g.rotation.y) * Math.min(1, delta * 5);
  });

  function enter(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    setHover(true);
    document.body.style.cursor = "pointer";
  }
  function leave() {
    setHover(false);
    document.body.style.cursor = "";
  }

  return (
    <group position={[x, 0, 0]} onPointerOver={enter} onPointerOut={leave} onClick={() => onSelect?.(player)}>
      {/* Bục gỗ sơn nhạt kiểu nội thất văn phòng */}
      <RoundedBox args={[1.24, height, 1.1]} radius={0.06} smoothness={4} position={[0, height / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={hover ? "#ffffff" : "#f3f0ea"} roughness={0.75} />
      </RoundedBox>
      <mesh position={[0, height + 0.012, 0]} receiveShadow>
        <boxGeometry args={[1.3, 0.04, 1.16]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.35} />
      </mesh>

      <group ref={group} position={[0, height, 0]}>
        <Suspense fallback={<PlaceholderFigure color={color} />}>
          {player.avatarUrl ? <GlbFigure url={player.avatarUrl} /> : <PlaceholderFigure color={color} />}
        </Suspense>
        {hover ? (
          <Html center distanceFactor={4.5} position={[0, 2.15, 0]} zIndexRange={[40, 0]}>
            <div className="pointer-events-none w-52 rounded-2xl border border-border bg-card/95 p-3 text-center shadow-[var(--shadow-lift)] backdrop-blur">
              <p className="font-heading truncate text-sm font-extrabold">{player.displayName}</p>
              <p className="type-meta truncate">{player.unit || "Chưa rõ đơn vị"}</p>
              <p className="mt-1.5 text-xs font-bold text-primary">
                {RANK_LABEL[rank] ?? "Hạng"} · Cấp {player.level} · {player.xp} EXP
              </p>
              <p className="type-meta">{player.examsPassed} lượt đạt</p>
            </div>
          </Html>
        ) : null}
      </group>

      <Html center distanceFactor={3.4} position={[0, height / 2 - 0.05, 0.6]} zIndexRange={[30, 0]}>
        <div className="pointer-events-none rounded-full bg-background/85 px-2.5 py-1 text-center">
          <span className="font-heading block max-w-28 truncate text-[0.65rem] font-extrabold">{player.displayName}</span>
        </div>
      </Html>
    </group>
  );
}

/** Bối cảnh văn phòng lịch sự: sàn, tường, cửa sổ sáng và bàn làm việc phía sau. */
function OfficeRoom() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 18]} />
        <meshStandardMaterial color="#e7e3db" roughness={0.9} />
      </mesh>
      <mesh position={[0, 4, -4.2]} receiveShadow>
        <planeGeometry args={[24, 8]} />
        <meshStandardMaterial color="#f6f4f0" roughness={1} />
      </mesh>
      {/* Cửa sổ kính lấy sáng */}
      {[-4.4, 4.4].map((x) => (
        <mesh key={x} position={[x, 2.4, -4.15]}>
          <planeGeometry args={[3, 2.2]} />
          <meshStandardMaterial color="#cfe4f2" emissive="#bcd9ef" emissiveIntensity={0.5} roughness={0.2} />
        </mesh>
      ))}
      {/* Bàn làm việc + màn hình phía sau tạo chiều sâu */}
      {[-3.6, 3.6].map((x) => (
        <group key={x} position={[x, 0, -2.6]}>
          <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.1, 0.07, 0.95]} />
            <meshStandardMaterial color="#cbb79c" roughness={0.7} />
          </mesh>
          {[-0.9, 0.9].map((lx) => (
            <mesh key={lx} position={[lx, 0.36, 0]}>
              <boxGeometry args={[0.07, 0.72, 0.07]} />
              <meshStandardMaterial color="#8f8b85" roughness={0.5} metalness={0.3} />
            </mesh>
          ))}
          <mesh position={[0, 1.02, -0.2]}>
            <boxGeometry args={[0.8, 0.5, 0.04]} />
            <meshStandardMaterial color="#39424e" roughness={0.35} />
          </mesh>
        </group>
      ))}
      {/* Chậu cây góc phòng */}
      {[-6.2, 6.2].map((x) => (
        <group key={x} position={[x, 0, -2]}>
          <mesh position={[0, 0.22, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.18, 0.44, 20]} />
            <meshStandardMaterial color="#b9a892" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.85, 0]} castShadow>
            <sphereGeometry args={[0.45, 20, 20]} />
            <meshStandardMaterial color="#6c9a6e" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Sân khấu vinh danh 3D: ba nhân vật đứng trên bục trong không gian văn phòng.
 * Di chuột vào từng nhân vật để xem nhanh thông tin, bấm để mở hồ sơ.
 */
export default function OfficePodium3D({
  players,
  onSelect,
}: {
  players: PodiumPlayer[];
  onSelect?: (p: PodiumPlayer) => void;
}) {
  const layout = [
    { x: 0, height: 1.05 },
    { x: -1.55, height: 0.75 },
    { x: 1.55, height: 0.55 },
  ];

  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 2.3, 7.6], fov: 32 }}
      onCreated={({ camera }) => camera.lookAt(0, 1.15, 0)}>
      <color attach="background" args={["#f7f6f3"]} />
      <fog attach="fog" args={["#f7f6f3", 9, 20]} />
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[3.5, 6, 4]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-4, 3, -2]} intensity={0.35} />
      <Suspense fallback={null}>
        <OfficeRoom />
        {players.slice(0, 3).map((p, i) => (
          <Podium key={p.employeeId} player={p} rank={i} x={layout[i].x} height={layout[i].height} onSelect={onSelect} />
        ))}
        <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={12} blur={2.4} far={4} />
        <Environment preset="city" />
      </Suspense>
    </Canvas>
  );
}
