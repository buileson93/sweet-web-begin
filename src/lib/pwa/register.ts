/**
 * Đăng ký Service Worker cho chế độ ngoại tuyến (chỉ ở bản đã xuất bản).
 *
 * Nguyên tắc an toàn: KHÔNG bao giờ đăng ký trong môi trường xem trước của
 * Lovable, trong iframe hay khi chạy dev — vì Service Worker là trạng thái
 * do trình duyệt giữ, dễ phục vụ lại HTML cũ sau khi đã sửa mã.
 */
const SW_URL = "/sw.js";

function isPreviewHost(hostname: string): boolean {
  return (
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
}

async function unregisterAppWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((reg) => (reg.active?.scriptURL ?? reg.installing?.scriptURL ?? "").endsWith(SW_URL))
      .map((reg) => reg.unregister()),
  );
}

/** Gọi một lần từ useEffect ở route gốc. */
export function registerOfflineWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const refused =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    isPreviewHost(window.location.hostname) ||
    new URLSearchParams(window.location.search).has("sw") ;

  if (refused) {
    void unregisterAppWorkers();
    return;
  }

  void navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => undefined);
}
