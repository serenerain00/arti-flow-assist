import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

const AGENT_ID = "agent_9301kpe2x3y2e31a8wwvsbxcm9nh";

/**
 * Issues a single-use WebRTC conversation token for the ElevenLabs agent.
 * Keeps ELEVENLABS_API_KEY server-only.
 */
export const Route = createFileRoute("/api/elevenlabs/token")({
  server: {
    handlers: {
      GET: async () => {

        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "ELEVENLABS_API_KEY is not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        const res = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${AGENT_ID}`,
          { headers: { "xi-api-key": apiKey } }
        );

        if (!res.ok) {
          const err = await res.text();
          return new Response(
            JSON.stringify({ error: `ElevenLabs token request failed: ${res.status} ${err}` }),
            { status: 502, headers: { "Content-Type": "application/json" } }
          );
        }

        const { token } = (await res.json()) as { token: string };
        return new Response(JSON.stringify({ token }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
