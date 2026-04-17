import { createFileRoute } from "@tanstack/react-router";

/**
 * Mints a short-lived ElevenLabs conversation token for the configured agent.
 * Keeps the long-lived API key on the server — only the ephemeral token
 * reaches the browser, which is exactly what ElevenLabs recommends for
 * public-facing apps.
 */
export const Route = createFileRoute("/api/elevenlabs/conversation-token")({
  server: {
    handlers: {
      POST: async () => {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        const agentId = process.env.ELEVENLABS_AGENT_ID;

        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "ELEVENLABS_API_KEY is not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
        if (!agentId) {
          return new Response(
            JSON.stringify({ error: "ELEVENLABS_AGENT_ID is not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
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
          return new Response(
            JSON.stringify({
              error: "Failed to mint conversation token",
              status: res.status,
            }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          );
        }

        const { token } = (await res.json()) as { token: string };
        return new Response(JSON.stringify({ token, agentId }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
