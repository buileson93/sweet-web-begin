import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BugReportInput = {
  kind: string;
  title: string;
  description: string;
  contact: string;
  reporter_name: string;
  path: string;
  device: Record<string, unknown>;
  user_agent: string;
  /** Ảnh chụp màn hình đã nén ở phía trình duyệt, dạng data URL JPEG. */
  shot_data_url?: string;
};

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

const KINDS = ["bug", "idea", "thanks"];
const STATUSES = ["new", "doing", "done", "wontfix"];
const MAX_SHOT_BYTES = 800 * 1024;

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

function decodeDataUrl(dataUrl: string): Uint8Array | null {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  const binary = atob(match[2] ?? "");
  if (binary.length > MAX_SHOT_BYTES) return null;
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Người dùng gửi phiếu báo lỗi / góp ý (không cần đăng nhập). */
export const submitBugReport = createServerFn({ method: "POST" })
  .inputValidator((data: BugReportInput) => data)
  .handler(async ({ data }) => {
    const description = str(data.description, 4000);
    if (description.length < 5) return { ok: false as const, message: "Vui lòng mô tả rõ hơn." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ip, source } = resolveClientIp();

    let shotPath = "";
    if (data.shot_data_url) {
      const bytes = decodeDataUrl(data.shot_data_url);
      if (bytes) {
        const name = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabaseAdmin.storage
          .from("bug-shots")
          .upload(name, bytes, { contentType: "image/jpeg", upsert: false });
        if (!error) shotPath = name;
        else console.error("upload bug shot failed:", error.message);
      }
    }

    const { error } = await supabaseAdmin.from("bug_reports").insert({
      kind: KINDS.includes(data.kind) ? data.kind : "bug",
      title: str(data.title, 160),
      description,
      contact: str(data.contact, 160),
      reporter_name: str(data.reporter_name, 120),
      path: str(data.path, 200),
      shot_path: shotPath,
      device: (data.device ?? {}) as never,
      user_agent: str(data.user_agent, 400),
      ip,
      ip_source: source,
    });
    if (error) {
      console.error("insert bug report failed:", error.message);
      return { ok: false as const, message: "Không gửi được, vui lòng thử lại." };
    }
    return { ok: true as const };
  });

async function assertAdmin(supabase: {
  from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => Promise<{ data: unknown[] | null }> } };
}) {
  const { data } = await supabase.from("user_roles").select("role").eq("role", "admin");
  if (!data || data.length === 0) throw new Error("Chỉ quản trị viên mới xem được báo lỗi");
}

/** Ảnh đính kèm nằm trong kho riêng tư — cấp liên kết xem tạm cho quản trị viên. */
export const getBugShotUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { path: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("bug-shots")
      .createSignedUrl(String(data.path).slice(0, 200), 60 * 30);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl ?? "" };
  });

/** Cập nhật trạng thái xử lý một phiếu báo lỗi. */
export const updateBugReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; status?: string; admin_note?: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { status?: string; resolved_at?: string | null; admin_note?: string } = {};
    if (data.status && STATUSES.includes(data.status)) {
      patch.status = data.status;
      patch.resolved_at = data.status === "done" ? new Date().toISOString() : null;
    }
    if (typeof data.admin_note === "string") patch.admin_note = data.admin_note.slice(0, 2000);
    if (Object.keys(patch).length === 0) return { ok: true as const };

    const { error } = await supabaseAdmin.from("bug_reports").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
