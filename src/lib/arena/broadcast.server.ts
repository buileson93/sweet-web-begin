/**
 * Phát sự kiện tới kênh realtime. CHỈ máy chủ được phát;
 * trình duyệt chỉ lắng nghe. Dùng REST broadcast để không phải giữ WebSocket.
 */
export async function broadcastTopic(
  topic: string,
  event: string,
  payload: unknown,
): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages: [{ topic, event, payload, private: false }] }),
    });
  } catch {
    /* Mất broadcast không được làm hỏng trận: client còn cơ chế hỏi lại (polling). */
  }
}

/** Kênh của một ván so tài. */
export async function broadcastDuel(duelId: string, event: string, payload: unknown) {
  return broadcastTopic(`duel:${duelId}`, event, payload);
}

/** Kênh riêng của một nhân viên (lời mời thách đấu, thông báo cá nhân). */
export async function broadcastToEmployee(employeeId: string, event: string, payload: unknown) {
  return broadcastTopic(`arena-user:${employeeId}`, event, payload);
}
