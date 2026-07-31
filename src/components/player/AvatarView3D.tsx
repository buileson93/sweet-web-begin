import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, useGLTF } from "@react-three/drei";

/** Mô hình avatar GLB (Ready Player Me) — chỉ dựng ở phía trình duyệt. */
function AvatarModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} position={[0, -1.35, 0]} scale={1.2} />;
}

/** Khung xem avatar 3D xoay được bằng chuột/ngón tay. */
export default function AvatarView3D({ url, className }: { url: string; className?: string }) {
  return (
    <div className={className}>
      <Canvas camera={{ position: [0, 0.25, 2.6], fov: 32 }} dpr={[1, 1.8]}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 3, 2]} intensity={1.1} />
        <Suspense fallback={null}>
          <AvatarModel url={url} />
          <Environment preset="city" />
        </Suspense>
        <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={1.1} maxPolarAngle={1.7} />
      </Canvas>
    </div>
  );
}
