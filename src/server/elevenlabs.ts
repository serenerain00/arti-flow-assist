import { createServerFn } from "@tanstack/react-start";

/**
 * Mints a short-lived ElevenLabs conversation token for the configured agent.
 * The long-lived API key stays on the server — only the ephemeral token
 * reaches the browser, which is exactly what ElevenLabs recommends for
 * public-facing apps.
 */
export const getElevenLabsConversationToken = createServerFn({
  method: "POST",
}).handler(async () => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }
  if (!agentId) {
    throw new Error("ELEVENLABS_AGENT_ID is not configured");
  }

  const url = `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(
    agentId,
  )}`;

  const res = await fetch(url, {
    headers: { "xi-api-key": apiKey },
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("ElevenLabs token error", res.status, detail);
    throw new Error(`Failed to mint conversation token (${res.status})`);
  }

  const { token } = (await res.json()) as { token: string };
  return { token, agentId };
});
