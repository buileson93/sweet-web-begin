/**
 * Ảnh chụp thiết bị của phiên thi (dữ liệu JSON, không phải hình ảnh).
 *
 * Mục tiêu: dù máy khách xoá cookie/localStorage, chặn thống kê, hay đổi máy,
 * phiên thi vẫn luôn có IP + trình duyệt do máy chủ tự đọc từ request.
 */
export type ExamDeviceSnapshot = {
  ip: string;
  ip_source: string;
  user_agent: string;
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  device_type: string;
  device_model: string;
  screen: string;
  viewport: string;
  pixel_ratio: number;
  language: string;
  timezone: string;
  network_type: string;
  is_pwa: boolean;
  is_touch: boolean;
  captured_at: string;
};

/** Thông tin thiết bị hiển thị trong Theo dõi trực tiếp. */
export type ResolvedDevice = {
  ip: string;
  browser: string;
  os: string;
  deviceType: string;
  deviceModel: string;
  screen: string;
  network: string;
  language: string;
  timezone: string;
  isPwa: boolean;
  userAgent: string;
  seenAt: string;
};

export type VisitRow = {
  ip?: string | null;
  browser?: string | null;
  browser_version?: string | null;
  os?: string | null;
  os_version?: string | null;
  device_type?: string | null;
  device_model?: string | null;
  screen_w?: number | null;
  screen_h?: number | null;
  network_type?: string | null;
  language?: string | null;
  timezone?: string | null;
  is_pwa?: boolean | null;
  user_agent?: string | null;
  created_at: string;
};

const dstr = (v: unknown, max = 80) => String(v ?? "").slice(0, max);
const dnum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const trim = (v: unknown) => String(v ?? "").trim();

export function buildDeviceSnapshot(
  device: Record<string, unknown> | undefined,
  request: { ip?: string; ipSource?: string; userAgent?: string } | undefined,
  capturedAt: string = new Date().toISOString(),
): ExamDeviceSnapshot {
  const d = device ?? {};
  const w = dnum(d["screen_w"]);
  const h = dnum(d["screen_h"]);
  const vw = dnum(d["viewport_w"]);
  const vh = dnum(d["viewport_h"]);
  return {
    ip: dstr(request?.ip, 60),
    ip_source: dstr(request?.ipSource, 40),
    user_agent: dstr(d["user_agent"] || request?.userAgent, 400),
    browser: dstr(d["browser"], 40),
    browser_version: dstr(d["browser_version"], 20),
    os: dstr(d["os"], 40),
    os_version: dstr(d["os_version"], 20),
    device_type: dstr(d["device_type"], 20),
    device_model: dstr(d["device_model"], 80),
    screen: w && h ? `${w}×${h}` : "",
    viewport: vw && vh ? `${vw}×${vh}` : "",
    pixel_ratio: dnum(d["pixel_ratio"]),
    language: dstr(d["language"], 20),
    timezone: dstr(d["timezone"], 60),
    network_type: dstr(d["network_type"], 20),
    is_pwa: Boolean(d["is_pwa"]),
    is_touch: Boolean(d["is_touch"]),
    captured_at: capturedAt,
  };
}

/** Ảnh chụp có dữ liệu thật hay chỉ là object rỗng. */
export function hasSnapshotData(raw: unknown): raw is Record<string, unknown> {
  if (!raw || typeof raw !== "object") return false;
  return Object.keys(raw as Record<string, unknown>).length > 0;
}

/** Lượt truy cập gần giờ bắt đầu thi nhất (dự phòng cho phiên cũ). */
export function pickClosestVisit(visits: VisitRow[] | null | undefined, startedAt: string): VisitRow | null {
  const startedMs = new Date(startedAt).getTime();
  const sorted = (visits ?? [])
    .slice()
    .sort(
      (a, b) =>
        Math.abs(new Date(a.created_at).getTime() - startedMs) -
        Math.abs(new Date(b.created_at).getTime() - startedMs),
    );
  return sorted[0] ?? null;
}

/** Ưu tiên ảnh chụp trong phiên, sau đó mới đến lượt truy cập. */
export function resolveSessionDevice(
  rawSnapshot: unknown,
  visits: VisitRow[] | null | undefined,
  startedAt: string,
): ResolvedDevice | null {
  if (hasSnapshotData(rawSnapshot)) {
    const snap = rawSnapshot;
    return {
      ip: trim(snap["ip"]) || "—",
      browser: [trim(snap["browser"]), trim(snap["browser_version"])].filter(Boolean).join(" ") || "—",
      os: [trim(snap["os"]), trim(snap["os_version"])].filter(Boolean).join(" ") || "—",
      deviceType: trim(snap["device_type"]) || "—",
      deviceModel: trim(snap["device_model"]) || "—",
      screen: trim(snap["screen"]) || "—",
      network: trim(snap["network_type"]) || "—",
      language: trim(snap["language"]) || "—",
      timezone: trim(snap["timezone"]) || "—",
      isPwa: Boolean(snap["is_pwa"]),
      userAgent: trim(snap["user_agent"]) || "—",
      seenAt: trim(snap["captured_at"]) || startedAt,
    };
  }

  const visit = pickClosestVisit(visits, startedAt);
  if (!visit) return null;
  return {
    ip: visit.ip || "—",
    browser: [visit.browser, visit.browser_version].filter(Boolean).join(" ") || "—",
    os: [visit.os, visit.os_version].filter(Boolean).join(" ") || "—",
    deviceType: visit.device_type || "—",
    deviceModel: visit.device_model || "—",
    screen: visit.screen_w && visit.screen_h ? `${visit.screen_w}×${visit.screen_h}` : "—",
    network: visit.network_type || "—",
    language: visit.language || "—",
    timezone: visit.timezone || "—",
    isPwa: Boolean(visit.is_pwa),
    userAgent: visit.user_agent || "—",
    seenAt: visit.created_at,
  };
}
