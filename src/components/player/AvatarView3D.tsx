import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls, useGLTF } from "@react-three/drei";
import { ACESFilmicToneMapping } from "three";

/** Mô hình avatar GLB (Ready Player Me) — chỉ dựng ở phía trình duyệt. */
function AvatarModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} position={[0, -1.35, 0]} scale={1.2} />;
}

/** Khung xem avatar 3D xoay được bằng chuột/ngón tay, ánh sáng phong cách studio. */
export default function AvatarView3D({ url, className }: { url: string; className?: string }) {
  return (
    <div className={className}>
      <Canvas
        shadows
        camera={{ position: [0, 0.25, 2.5], fov: 30 }}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        <ambientLight intensity={0.45} />
        {/* Đèn chính + đèn viền cho khối mặt nổi, tự nhiên như ảnh chụp studio */}
        <directionalLight position={[2.2, 3, 2.4]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-2.4, 1.6, -1.8]} intensity={0.7} color="#cfe4ff" />
        <spotLight position={[0, 3.4, 1.6]} angle={0.5} penumbra={0.9} intensity={0.8} />
        <Suspense fallback={null}>
          <AvatarModel url={url} />
          <ContactShadows position={[0, -1.34, 0]} opacity={0.35} scale={4} blur={2.6} far={2} />
          <Environment preset="studio" />
        </Suspense>
        <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={1.15} maxPolarAngle={1.65} />
      </Canvas>
    </div>
  );
}
