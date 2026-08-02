/**
 * Nhận diện trình duyệt / hệ điều hành / loại thiết bị từ chuỗi User-Agent.
 *
 * Cố tình KHÔNG thu thập thông tin định danh cá nhân: không IP, không cookie
 * theo dõi xuyên trang, chỉ một mã phiên ngẫu nhiên lưu trong sessionStorage
 * để đếm "số phiên" thay vì đếm trùng lượt tải trang.
 */

export type DeviceVisitPayload = {
  visitor_key: string;
  path: string;
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  device_type: "mobile" | "tablet" | "desktop";
  screen_w: number;
  screen_h: number;
  viewport_w: number;
  viewport_h: number;
  pixel_ratio: number;
  language: string;
  timezone: string;
  is_pwa: boolean;
  is_touch: boolean;
  referrer_host: string;
};

const BROWSER_RULES: { name: string; re: RegExp }[] = [
  { name: "Edge", re: /Edg(?:e|A|iOS)?\/([\d.]+)/ },
  { name: "Opera", re: /(?:OPR|Opera)\/([\d.]+)/ },
  { name: "Samsung Internet", re: /SamsungBrowser\/([\d.]+)/ },
  { name: "Coc Coc", re: /coc_coc_browser\/([\d.]+)/ },
  { name: "Firefox", re: /(?:Firefox|FxiOS)\/([\d.]+)/ },
  { name: "Chrome", re: /(?:Chrome|CriOS)\/([\d.]+)/ },
  { name: "Safari", re: /Version\/([\d.]+).*Safari/ },
];

const OS_RULES: { name: string; re: RegExp }[] = [
  { name: "Windows", re: /Windows NT ([\d.]+)/ },
  { name: "Android", re: /Android ([\d.]+)/ },
  { name: "iOS", re: /(?:iPhone|iPad|iPod).*OS ([\d_]+)/ },
  { name: "macOS", re: /Mac OS X ([\d_]+)/ },
  { name: "Linux", re: /(Linux)/ },
];

const WINDOWS_NAMES: Record<string, string> = { "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7" };

function major(version: string) {
  return version.replace(/_/g, ".").split(".").slice(0, 2).join(".");
}

export function parseUserAgent(ua: string) {
  let browser = "Khác";
  let browserVersion = "";
  for (const rule of BROWSER_RULES) {
    const m = ua.match(rule.re);
    if (m) {
      browser = rule.name;
      browserVersion = (m[1] ?? "").split(".")[0] ?? "";
      break;
    }
  }

  let os = "Khác";
  let osVersion = "";
  for (const rule of OS_RULES) {
    const m = ua.match(rule.re);
    if (m) {
      os = rule.name;
      osVersion = rule.name === "Linux" ? "" : major(m[1] ?? "");
      if (rule.name === "Windows") osVersion = WINDOWS_NAMES[osVersion] ?? osVersion;
      break;
    }
  }

  return { browser, browserVersion, os, osVersion };
}

export function detectDeviceType(ua: string, width: number): DeviceVisitPayload["device_type"] {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua)) return "mobile";
  if (width > 0 && width < 640) return "mobile";
  if (width > 0 && width < 1024) return "tablet";
  return "desktop";
}

/** Mã phiên ngẫu nhiên, chỉ tồn tại trong tab hiện tại. */
export function getVisitorKey(): string {
  try {
    const KEY = "vatm:visitor-key";
    const existing = sessionStorage.getItem(KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return "";
  }
}

export function collectDeviceVisit(path: string): DeviceVisitPayload {
  const ua = navigator.userAgent ?? "";
  const { browser, browserVersion, os, osVersion } = parseUserAgent(ua);
  const viewportW = Math.round(window.innerWidth);

  let referrerHost = "";
  try {
    if (document.referrer) {
      const host = new URL(document.referrer).hostname;
      if (host && host !== window.location.hostname) referrerHost = host;
    }
  } catch {
    referrerHost = "";
  }

  const isPwa =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;

  return {
    visitor_key: getVisitorKey(),
    path: path.slice(0, 200),
    browser,
    browser_version: browserVersion,
    os,
    os_version: osVersion,
    device_type: detectDeviceType(ua, viewportW),
    screen_w: Math.round(window.screen?.width ?? 0),
    screen_h: Math.round(window.screen?.height ?? 0),
    viewport_w: viewportW,
    viewport_h: Math.round(window.innerHeight),
    pixel_ratio: Number((window.devicePixelRatio ?? 1).toFixed(2)),
    language: (navigator.language ?? "").slice(0, 20),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    is_pwa: Boolean(isPwa),
    is_touch: (navigator.maxTouchPoints ?? 0) > 0 || "ontouchstart" in window,
    referrer_host: referrerHost.slice(0, 120),
  };
}

/** Nhóm độ phân giải màn hình thành các mốc dễ đọc cho báo cáo. */
export function screenBucket(w: number, h: number) {
  if (!w || !h) return "Không rõ";
  return `${w}×${h}`;
}

/* ------------------------- Thông tin thiết bị mở rộng ------------------------- */

export type DeviceExtras = {
  device_model: string;
  platform_version: string;
  architecture: string;
  cpu_cores: number;
  memory_gb: number;
  network_type: string;
  downlink: number;
  save_data: boolean;
  user_agent: string;
};

type UaDataLike = {
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
};

/**
 * Thu thập thêm model máy, phiên bản hệ điều hành, cấu hình phần cứng và chất lượng mạng.
 * Mọi trường đều "cố gắng hết sức": trình duyệt không hỗ trợ thì trả về giá trị rỗng.
 */
export async function collectDeviceExtras(): Promise<DeviceExtras> {
  const nav = navigator as Navigator & {
    userAgentData?: UaDataLike;
    deviceMemory?: number;
    connection?: { effectiveType?: string; downlink?: number; saveData?: boolean };
  };

  let model = "";
  let platformVersion = "";
  let architecture = "";
  try {
    const values = await nav.userAgentData?.getHighEntropyValues?.([
      "model",
      "platformVersion",
      "architecture",
      "bitness",
      "fullVersionList",
    ]);
    if (values) {
      model = String(values.model ?? "");
      platformVersion = String(values.platformVersion ?? "");
      architecture = [values.architecture, values.bitness].filter(Boolean).join("-");
    }
  } catch {
    /* trình duyệt từ chối cung cấp — bỏ qua */
  }

  if (!model) model = modelFromUserAgent(navigator.userAgent ?? "");

  const connection = nav.connection;
  return {
    device_model: model.slice(0, 80),
    platform_version: platformVersion.slice(0, 40),
    architecture: architecture.slice(0, 40),
    cpu_cores: Math.max(0, Math.round(nav.hardwareConcurrency ?? 0)),
    memory_gb: Number(nav.deviceMemory ?? 0),
    network_type: String(connection?.effectiveType ?? "").slice(0, 20),
    downlink: Number(connection?.downlink ?? 0),
    save_data: Boolean(connection?.saveData),
    user_agent: (navigator.userAgent ?? "").slice(0, 400),
  };
}

/** Đoán tên máy từ chuỗi User-Agent khi trình duyệt không cung cấp "model". */
export function modelFromUserAgent(ua: string): string {
  const android = ua.match(/Android [\d.]+;\s*([^;)]+?)(?:\s+Build|[;)])/);
  if (android?.[1]) return android[1].trim();
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows NT/.test(ua)) return "PC Windows";
  return "";
}

/** Bản ghi truy cập đầy đủ (đồng bộ + phần mở rộng cần chờ trình duyệt trả lời). */
export async function collectFullVisit(path: string): Promise<DeviceVisitPayload & DeviceExtras> {
  return { ...collectDeviceVisit(path), ...(await collectDeviceExtras()) };
}
