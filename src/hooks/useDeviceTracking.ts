import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { collectDeviceVisit } from "@/lib/deviceInfo";

/**
 * Ghi nhận thông tin thiết bị/trình duyệt cho thống kê quản trị.
 *
 * Nguyên tắc giảm tải: mỗi phiên (tab) chỉ ghi tối đa một lần cho mỗi đường dẫn,
 * và bỏ qua hoàn toàn khu vực quản trị để số liệu phản ánh người dùng thật.
 */
export function useDeviceTracking() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname.startsWith("/quan-tri") || pathname.startsWith("/nhat-ky") || pathname.startsWith("/nhap-du-lieu")) {
      return;
    }

    const seenKey = `vatm:visit-logged:${pathname}`;
    try {
      if (sessionStorage.getItem(seenKey)) return;
      sessionStorage.setItem(seenKey, "1");
    } catch {
      /* trình duyệt chặn storage -> vẫn ghi nhận một lần cho mỗi lần tải trang */
    }

    // Hoãn lại để không tranh tài nguyên với lần render đầu tiên.
    const timer = window.setTimeout(() => {
      const payload = collectDeviceVisit(pathname);
      void supabase
        .from("device_visits")
        .insert(payload)
        .then(({ error }) => {
          if (error) console.warn("Không ghi được thống kê thiết bị:", error.message);
        });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [pathname]);
}
