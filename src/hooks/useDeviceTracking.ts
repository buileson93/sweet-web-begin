import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

import { collectFullVisit, getVisitorKey } from "@/lib/deviceInfo";
import { attachVisitIdentity, recordDeviceVisit } from "@/lib/visits.functions";
import { drainVisits, enqueueVisit } from "@/lib/visits/queue";
import { PLAYER_IDENTITY_EVENT, readPlayerIdentity } from "@/lib/playerIdentity";


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
      void collectFullVisit(pathname).then((payload) => {
        // Kèm mã nhân viên khi người dùng đã đăng nhập nhanh, để thống kê không bị vô danh.
        enqueueVisit({ ...payload, employee_id: readPlayerIdentity()?.employeeId ?? "" });
        return flushVisits();
      });
    }, 1200);


    return () => window.clearTimeout(timer);
  }, [pathname]);

  // Có mạng trở lại thì đẩy nốt hàng đợi đã tích luỹ lúc ngoại tuyến.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => void flushVisits();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);
}

/** Gửi lần lượt các bản ghi đang xếp hàng; thất bại thì trả lại hàng đợi. */
async function flushVisits(): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const items = drainVisits();
  for (const payload of items) {
    try {
      await recordDeviceVisit({ data: payload as never });
    } catch {
      enqueueVisit(payload);
      return;
    }
  }
}
