import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import type { DeviceExtras, DeviceVisitPayload } from "@/lib/deviceInfo";

/** Lấy IP thật của khách từ header của proxy/CDN. */
function resolveClientIp(): { ip: string; source: string } {
  const candidates: [string, string | undefined][] = [
    ["cf-connecting-ip", getRequestHeader("cf-connecting-ip")],
    ["true-client-ip", getRequestHeader("true-client-ip")],
    ["x-real-ip", getRequestHeader("x-real-ip")],
    ["x-forwarded-for", getRequestHeader("x-forwarded-for")],
  ];
  for (const [source, raw] of candidates) {
    const value = (raw ?? "").split(",")[0]?.trim();
    if (value) return { ip: value.slice(0, 60), source };
  }
  return { ip: "", source: "" };
}

const num = (v: unknown, max = 100000) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n * 100) / 100, 0), max) : 0;
};
const str = (v: unknown, max: number) => String(v ?? "").slice(0, max);

export const recordDeviceVisit = createServerFn({ method: "POST" })
  .inputValidator((data: DeviceVisitPayload & Partial<DeviceExtras>) => data)
  .handler(async ({ data }) => {
    const { ip, source } = resolveClientIp();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const row = {
      visitor_key: str(data.visitor_key, 64),
      path: str(data.path, 200),
      browser: str(data.browser, 40),
      browser_version: str(data.browser_version, 20),
      os: str(data.os, 40),
      os_version: str(data.os_version, 20),
      device_type: ["mobile", "tablet", "desktop"].includes(data.device_type) ? data.device_type : "desktop",
      screen_w: num(data.screen_w),
      screen_h: num(data.screen_h),
      viewport_w: num(data.viewport_w),
      viewport_h: num(data.viewport_h),
      pixel_ratio: num(data.pixel_ratio, 10),
      language: str(data.language, 20),
      timezone: str(data.timezone, 60),
      is_pwa: Boolean(data.is_pwa),
      is_touch: Boolean(data.is_touch),
      referrer_host: str(data.referrer_host, 120),
      ip,
      ip_source: source,
      device_model: str(data.device_model, 80),
      platform_version: str(data.platform_version, 40),
      architecture: str(data.architecture, 40),
      cpu_cores: num(data.cpu_cores, 512),
      memory_gb: num(data.memory_gb, 1024),
      network_type: str(data.network_type, 20),
      downlink: num(data.downlink, 10000),
      save_data: Boolean(data.save_data),
      user_agent: str(data.user_agent, 400),
    };

    const { error } = await supabaseAdmin.from("device_visits").insert(row);
    if (error) {
      console.error("record device visit failed:", error.message);
      return { ok: false };
    }
    return { ok: true };
  });
