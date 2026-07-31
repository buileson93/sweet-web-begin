/**
 * Nhật ký sự cố realtime của một ván so tài (chỉ nằm trong bộ nhớ trình duyệt).
 * Dùng để người chơi/quản trị viên gửi lại chi tiết khi trạng thái bị lệch.
 */

export type DiagKind =
  | "connect"
  | "reconnect"
  | "disconnect"
  | "reconcile"
  | "duplicate"
  | "stale"
  | "timeout"
  | "error"
  | "slow";

export type DiagEntry = {
  id: number;
  at: number;
  kind: DiagKind;
  message: string;
  detail?: Record<string, unknown>;
};

export const DIAG_LABELS: Record<DiagKind, string> = {
  connect: "Kết nối",
  reconnect: "Kết nối lại",
  disconnect: "Mất kết nối",
  reconcile: "Đồng bộ lại trạng thái",
  duplicate: "Sự kiện trùng",
  stale: "Sự kiện tới muộn",
  timeout: "Quá thời gian",
  error: "Lỗi",
  slow: "Độ trễ cao",
};

const MAX_ENTRIES = 200;

export function createDiagLog(max = MAX_ENTRIES) {
  let seq = 0;
  let entries: DiagEntry[] = [];
  return {
    push(kind: DiagKind, message: string, detail?: Record<string, unknown>): DiagEntry {
      seq += 1;
      const entry: DiagEntry = { id: seq, at: Date.now(), kind, message, detail };
      entries = [...entries, entry].slice(-max);
      return entry;
    },
    list(): DiagEntry[] {
      return entries;
    },
    clear() {
      entries = [];
    },
  };
}

/** Kết xuất nhật ký thành văn bản thuần để người dùng sao chép và gửi đi. */
export function formatDiagReport(
  meta: { duelId: string; round?: number; version?: number; ping?: number | null; skew?: number; reconnects?: number },
  entries: DiagEntry[],
): string {
  const head = [
    `Báo cáo sự cố ván so tài`,
    `Mã ván: ${meta.duelId}`,
    `Lượt: ${meta.round ?? "—"} | Phiên bản: ${meta.version ?? "—"}`,
    `Ping: ${meta.ping ?? "—"}ms | Lệch đồng hồ: ${Math.round(meta.skew ?? 0)}ms | Số lần kết nối lại: ${meta.reconnects ?? 0}`,
    `Thời điểm xuất: ${new Date().toISOString()}`,
    "",
  ];
  const body = entries.map((e) => {
    const time = new Date(e.at).toLocaleTimeString("vi-VN", { hour12: false });
    const detail = e.detail ? ` ${JSON.stringify(e.detail)}` : "";
    return `[${time}] ${DIAG_LABELS[e.kind]}: ${e.message}${detail}`;
  });
  return [...head, ...(body.length ? body : ["(không có sự cố nào được ghi nhận)"])].join("\n");
}
