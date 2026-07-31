/**
 * Phát sự kiện tới kênh realtime. CHỈ máy chủ được phát;
 * trình duyệt chỉ lắng nghe. Dùng REST broadcast để không phải giữ WebSocket.
 */
export type BroadcastMessage = { event: string; payload: unknown };

/** Gửi nhiều sự kiện trong MỘT yêu cầu để giảm số vòng mạng và số lần vẽ lại giao diện. */
export async function broadcastBatch(topic: string, messages: BroadcastMessage[]): Promise<void> {
  if (messages.length === 0) return;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        messages: messages.map((m) => ({ topic, event: m.event, payload: m.payload, private: false })),
      }),
    });
  } catch {
    /* Mất broadcast không được làm hỏng trận: client còn cơ chế hỏi lại (polling). */
  }
}

export async function broadcastTopic(
  topic: string,
  event: string,
  payload: unknown,
): Promise<void> {
  return broadcastBatch(topic, [{ event, payload }]);
}

/** Kênh của một ván so tài. */
export async function broadcastDuel(duelId: string, event: string, payload: unknown) {
  return broadcastTopic(`duel:${duelId}`, event, payload);
}

/** Gộp nhiều sự kiện của cùng một ván so tài vào một lô. */
export async function broadcastDuelBatch(duelId: string, messages: BroadcastMessage[]) {
  return broadcastBatch(`duel:${duelId}`, messages);
}


/** Kênh riêng của một nhân viên (lời mời thách đấu, thông báo cá nhân). */
export async function broadcastToEmployee(employeeId: string, event: string, payload: unknown) {
  return broadcastTopic(`arena-user:${employeeId}`, event, payload);
}
