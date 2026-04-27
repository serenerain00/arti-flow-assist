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

    // Streaming endpoint + max latency optimization + low-bitrate voice MP3.
    //
    //  • /stream          — server starts emitting audio as soon as it's
    //                       generated, ~150–200 ms sooner than the buffered
    //                       endpoint. We still buffer the body server-side
    //                       (we don't stream to the browser), but the model
    //                       finishes faster end-to-end.
    //  • optimize_streaming_latency=3 — max gen-time optimization without
    //                       disabling the text normalizer (kept so "Step 4
    //                       of 9" still pronounces correctly).
    //  • output_format=mp3_22050_32 — 32 kbps voice-grade MP3. The default
    //                       192 kbps MP3 is 6× larger; for an OR voice
    //                       prompt the lower bitrate is inaudible and cuts
    //                       both server-gen time and browser-side decode.
    const url =
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream` +
      `?optimize_streaming_latency=3&output_format=mp3_22050_32`;
    const res = await fetch(url, {
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
