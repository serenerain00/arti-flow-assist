import { createServerFn } from "@tanstack/react-start";

/**
 * Calls ElevenLabs TTS and returns the audio as a base64 string.
 * The API key and voice ID stay on the server — only audio bytes reach the browser.
 */
export const speakText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as { text: string })
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured");
    if (!voiceId) throw new Error("ELEVENLABS_VOICE_ID is not configured");

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: data.text, model_id: "eleven_flash_v2_5" }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`ElevenLabs TTS error (${res.status}): ${detail}`);
    }

    const buffer = await res.arrayBuffer();
    return { audioBase64: Buffer.from(buffer).toString("base64") };
  });
