/**
 * Phát sự kiện tới kênh realtime của trận. CHỈ máy chủ được phát;
 * trình duyệt chỉ lắng nghe. Dùng REST broadcast để không phải giữ WebSocket.
 */
export async function broadcastDuel(
  duelId: string,
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
      body: JSON.stringify({
        messages: [{ topic: `duel:${duelId}`, event, payload, private: false }],
      }),
    });
  } catch {
    /* Mất broadcast không được làm hỏng trận: client còn cơ chế hỏi lại (polling). */
  }
}
