import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import { ACESFilmicToneMapping, MathUtils, type Group } from "three";

/**
 * Nhân vật 3D mặc định phong cách công sở: sơ mi, áo vest, cà vạt, thẻ nhân viên.
 * Dựng bằng hình khối cơ bản nên nhẹ, không cần tải mô hình.
 */

type Palette = {
  skin: string;
  hair: string;
  suit: string;
  shirt: string;
  tie: string;
  trousers: string;
};

const PALETTES: Palette[] = [
  { skin: "#e8bf9a", hair: "#2b2320", suit: "#25324a", shirt: "#f6f8fb", tie: "#b3402f", trousers: "#1e2838" },
  { skin: "#f0cfae", hair: "#3a2b22", suit: "#39424f", shirt: "#eef4fb", tie: "#2f6ea8", trousers: "#2b323c" },
  { skin: "#dcae86", hair: "#181414", suit: "#4a4038", shirt: "#fbf7f1", tie: "#7a8f4f", trousers: "#3a332c" },
  { skin: "#f2d3b6", hair: "#4b3524", suit: "#2f3a3d", shirt: "#f3f8f7", tie: "#c08a2e", trousers: "#26302f" },
];

/** Chọn bảng màu ổn định theo tên để mỗi người một diện mạo riêng. */
function paletteFor(seed: string): Palette {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 9973;
  return PALETTES[h % PALETTES.length];
}

function Character({ palette, female }: { palette: Palette; female: boolean }) {
  const root = useRef<Group>(null);

  // Nhịp thở nhẹ + đung đưa rất khẽ cho có sức sống, không gây phân tâm.
  useFrame((state) => {
    const g = root.current;
    if (!g) return;
    const t = state.clock.getElapsedTime();
    g.position.y = Math.sin(t * 1.1) * 0.01;
    g.rotation.y = MathUtils.lerp(g.rotation.y, Math.sin(t * 0.35) * 0.22, 0.05);
  });

  const matSuit = { color: palette.suit, roughness: 0.72, metalness: 0.04 };
  const matShirt = { color: palette.shirt, roughness: 0.62 };
  const matSkin = { color: palette.skin, roughness: 0.55 };

  return (
    <group ref={root}>
      {/* Giày da */}
      {[-0.13, 0.13].map((x) => (
        <mesh key={x} position={[x, 0.045, 0.04]} castShadow receiveShadow>
          <boxGeometry args={[0.14, 0.075, 0.27]} />
          <meshStandardMaterial color="#1b1e24" roughness={0.3} metalness={0.2} />
        </mesh>
      ))}
      {/* Ống quần */}
      {[-0.13, 0.13].map((x) => (
        <mesh key={`leg-${x}`} position={[x, 0.47, 0]} castShadow>
          <capsuleGeometry args={[0.098, 0.62, 8, 20]} />
          <meshStandardMaterial color={palette.trousers} roughness={0.88} />
        </mesh>
      ))}
      {/* Hông + thắt lưng */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.38, 0.24, 0.24]} />
        <meshStandardMaterial color={palette.trousers} roughness={0.88} />
      </mesh>
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[0.39, 0.055, 0.25]} />
        <meshStandardMaterial color="#17181c" roughness={0.35} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.0, 0.128]}>
        <boxGeometry args={[0.055, 0.045, 0.012]} />
        <meshStandardMaterial color="#cbb37a" roughness={0.25} metalness={0.75} />
      </mesh>

      {/* Sơ mi trắng lộ ở giữa ngực */}
      <mesh position={[0, 1.32, 0.055]} castShadow>
        <boxGeometry args={[0.2, 0.6, 0.16]} />
        <meshStandardMaterial {...matShirt} />
      </mesh>
      {/* Cổ áo sơ mi */}
      {[-1, 1].map((s) => (
        <mesh key={`collar-${s}`} position={[s * 0.055, 1.585, 0.1]} rotation={[0.18, 0, s * 0.5]}>
          <boxGeometry args={[0.06, 0.11, 0.02]} />
          <meshStandardMaterial {...matShirt} />
        </mesh>
      ))}
      {/* Cà vạt */}
      <mesh position={[0, 1.545, 0.115]} rotation={[0.12, 0, 0]}>
        <boxGeometry args={[0.055, 0.075, 0.035]} />
        <meshStandardMaterial color={palette.tie} roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.35, 0.125]} rotation={[0.12, 0, 0]}>
        <boxGeometry args={[0.075, 0.33, 0.022]} />
        <meshStandardMaterial color={palette.tie} roughness={0.45} />
      </mesh>

      {/* Áo vest: khối thân dày, hai vạt trước ôm sát */}
      <mesh position={[0, 1.31, -0.02]} castShadow>
        <boxGeometry args={[0.42, 0.64, 0.24]} />
        <meshStandardMaterial {...matSuit} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.135, 1.31, 0.075]} rotation={[0, 0, s * 0.03]} castShadow>
          <boxGeometry args={[0.155, 0.64, 0.17]} />
          <meshStandardMaterial {...matSuit} />
        </mesh>
      ))}
      {/* Ve áo chữ V */}
      {[-1, 1].map((s) => (
        <mesh key={`lapel-${s}`} position={[s * 0.085, 1.5, 0.152]} rotation={[0, 0, s * 0.34]}>
          <boxGeometry args={[0.085, 0.24, 0.022]} />
          <meshStandardMaterial color={palette.suit} roughness={0.55} metalness={0.08} />
        </mesh>
      ))}
      {/* Khăn túi ngực */}
      <mesh position={[-0.155, 1.4, 0.155]} rotation={[0, 0, 0.06]}>
        <boxGeometry args={[0.06, 0.035, 0.014]} />
        <meshStandardMaterial color="#e9eef5" roughness={0.5} />
      </mesh>
      {/* Vai */}
      <mesh position={[0, 1.6, -0.01]} castShadow>
        <boxGeometry args={[0.5, 0.11, 0.25]} />
        <meshStandardMaterial {...matSuit} />
      </mesh>

      {/* Tay áo + bàn tay */}
      {[-1, 1].map((s) => (
        <group key={`arm-${s}`} position={[s * 0.28, 1.55, 0]} rotation={[0, 0, s * -0.07]}>
          <mesh position={[0, -0.24, 0]} castShadow>
            <capsuleGeometry args={[0.072, 0.44, 8, 20]} />
            <meshStandardMaterial {...matSuit} />
          </mesh>
          {/* Măng sét sơ mi */}
          <mesh position={[0, -0.47, 0]}>
            <cylinderGeometry args={[0.062, 0.062, 0.05, 18]} />
            <meshStandardMaterial {...matShirt} />
          </mesh>
          <mesh position={[0, -0.54, 0.005]} castShadow>
            <sphereGeometry args={[0.062, 20, 20]} />
            <meshStandardMaterial {...matSkin} />
          </mesh>
        </group>
      ))}

      {/* Dây đeo + thẻ nhân viên */}
      {[-1, 1].map((s) => (
        <mesh key={`lany-${s}`} position={[s * 0.062, 1.5, 0.075]} rotation={[0.16, 0, s * 0.2]}>
          <boxGeometry args={[0.016, 0.2, 0.01]} />
          <meshStandardMaterial color="#3d6fb0" roughness={0.75} />
        </mesh>
      ))}
      <mesh position={[0.055, 1.31, 0.15]} rotation={[0.06, 0, -0.08]} castShadow>
        <boxGeometry args={[0.1, 0.135, 0.01]} />
        <meshStandardMaterial color="#f4f6f9" roughness={0.35} metalness={0.1} />
      </mesh>
      <mesh position={[0.055, 1.355, 0.157]} rotation={[0.06, 0, -0.08]}>
        <boxGeometry args={[0.08, 0.03, 0.004]} />
        <meshStandardMaterial color="#3d6fb0" roughness={0.5} />
      </mesh>


      {/* Cổ + đầu */}
      <mesh position={[0, 1.71, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.085, 0.11, 20]} />
        <meshStandardMaterial {...matSkin} />
      </mesh>
      <mesh position={[0, 1.9, 0]} castShadow>
        <sphereGeometry args={[0.175, 32, 32]} />
        <meshStandardMaterial {...matSkin} />
      </mesh>
      {/* Tai */}
      {[-1, 1].map((s) => (
        <mesh key={`ear-${s}`} position={[s * 0.172, 1.9, 0]} castShadow>
          <sphereGeometry args={[0.038, 16, 16]} />
          <meshStandardMaterial {...matSkin} />
        </mesh>
      ))}
      {/* Mắt */}
      {[-1, 1].map((s) => (
        <group key={`eye-${s}`} position={[s * 0.062, 1.92, 0.152]}>
          <mesh>
            <sphereGeometry args={[0.027, 16, 16]} />
            <meshStandardMaterial color="#fbfbfb" roughness={0.25} />
          </mesh>
          <mesh position={[0, 0, 0.018]}>
            <sphereGeometry args={[0.014, 16, 16]} />
            <meshStandardMaterial color="#2a2320" roughness={0.2} />
          </mesh>
        </group>
      ))}
      {/* Lông mày */}
      {[-1, 1].map((s) => (
        <mesh key={`brow-${s}`} position={[s * 0.063, 1.968, 0.152]} rotation={[0, 0, s * 0.12]}>
          <boxGeometry args={[0.05, 0.011, 0.012]} />
          <meshStandardMaterial color={palette.hair} roughness={0.8} />
        </mesh>
      ))}
      {/* Mũi + miệng */}
      <mesh position={[0, 1.888, 0.168]}>
        <coneGeometry args={[0.022, 0.05, 12]} />
        <meshStandardMaterial {...matSkin} />
      </mesh>
      <mesh position={[0, 1.832, 0.158]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.05, 0.009, 0.01]} />
        <meshStandardMaterial color="#a4614f" roughness={0.6} />
      </mesh>
      {/* Tóc: gọn gàng, phù hợp môi trường công sở */}
      <mesh position={[0, 1.935, -0.008]} castShadow>
        <sphereGeometry args={[0.186, 32, 32, 0, Math.PI * 2, 0, Math.PI / 1.85]} />
        <meshStandardMaterial color={palette.hair} roughness={0.85} />
      </mesh>
      {female ? (
        <mesh position={[0, 1.78, -0.09]} castShadow>
          <sphereGeometry args={[0.15, 24, 24]} />
          <meshStandardMaterial color={palette.hair} roughness={0.85} />
        </mesh>
      ) : (
        <mesh position={[0, 1.985, 0.05]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.24, 0.03, 0.13]} />
          <meshStandardMaterial color={palette.hair} roughness={0.85} />
        </mesh>
      )}
    </group>
  );
}

/** Khung dựng nhân vật công sở 3D (dùng khi nhân viên chưa tạo avatar riêng). */
export default function OfficeAvatar3D({
  seed = "vatm",
  female = false,
  /** `bust` chỉ lấy phần đầu–vai (dùng cho ảnh đại diện tròn). */
  framing = "full",
  className,
}: {
  seed?: string;
  female?: boolean;
  framing?: "full" | "bust";
  className?: string;
}) {
  const bust = framing === "bust";
  const palette = useMemo(() => paletteFor(seed), [seed]);

  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: bust ? [0, 1.9, 1.35] : [0, 1.2, 4.6], fov: 30 }}
        onCreated={({ camera }) => camera.lookAt(0, bust ? 1.86 : 1.0, 0)}
        gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[2.2, 3, 2.4]} intensity={1.45} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-2.4, 1.6, -1.6]} intensity={0.6} color="#cfe4ff" />
        <Suspense fallback={null}>
          <Character palette={palette} female={female} />
          <ContactShadows position={[0, 0.01, 0]} opacity={0.34} scale={3.2} blur={2.4} far={2} />
          <Environment preset="studio" />
        </Suspense>
      </Canvas>
    </div>
  );
}
