import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
const A = lazy(() => import("@/components/player/OfficeAvatar3D"));
export const Route = createFileRoute("/tmp-avatar")({ component: () => (
  <div className="flex gap-4 p-6">
    <Suspense fallback={null}><A seed="Nguyen Van A" className="h-[520px] w-[380px] bg-white" /></Suspense>
    <Suspense fallback={null}><A seed="Tran Thi B" female className="h-[520px] w-[380px] bg-white" /></Suspense>
  </div>) });
