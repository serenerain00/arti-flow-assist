import { createServerFn } from "@tanstack/react-start";

/**
 * Normalize medical / clinical strings before TTS so ElevenLabs voices
 * pronounce them correctly. ElevenLabs reads "A+" as "ay" or "ay-plus",
 * "ml" letter-by-letter, "MAP" as "M-A-P" instead of the syllable, etc.
 * The mapping below covers the high-frequency offenders in OR speech;
 * extend as new ones surface.
 *
 * Order matters: do the longer, more specific replacements first
 * (e.g. "AB+" before "A+", "mmHg" before "mm").
 */
function normalizeForTts(input: string): string {
  let s = input;

  // ── Blood types: "A+" / "AB-" → "ay positive" / "ay bee negative", etc.
  // ElevenLabs reads a lone "A" as the indefinite article ("uh"), so we
  // expand each letter to its phonetic spelling. Match upper or lowercase,
  // with optional space before +/-. Order matters — "AB" before single A/B.
  const BLOOD_LETTERS: Record<string, string> = {
    AB: "ay bee",
    A: "ay",
    B: "bee",
    O: "oh",
  };
  s = s.replace(
    /\b(AB|A|B|O)\s?([+-])/g,
    (_, group: string, sign: string) =>
      `${BLOOD_LETTERS[group] ?? group} ${sign === "+" ? "positive" : "negative"}`,
  );

  // ── Vitals + lab units. Word-boundary on the left, lookbehind for
  //    a digit on the left so we only catch values like "120 mmHg",
  //    "30 mg", "3 L", not free-floating "ml" inside other words.
  s = s.replace(/(\d+(?:\.\d+)?)\s*mmHg\b/g, "$1 millimeters of mercury");
  s = s.replace(/(\d+(?:\.\d+)?)\s*mEq\/L\b/gi, "$1 milliequivalents per liter");
  s = s.replace(/(\d+(?:\.\d+)?)\s*mcg\b/g, "$1 micrograms");
  s = s.replace(/(\d+(?:\.\d+)?)\s*mg\b/g, "$1 milligrams");
  s = s.replace(/(\d+(?:\.\d+)?)\s*kg\b/g, "$1 kilograms");
  s = s.replace(/(\d+(?:\.\d+)?)\s*lb\b/g, "$1 pounds");
  s = s.replace(/(\d+(?:\.\d+)?)\s*mL\b/g, "$1 milliliters");
  s = s.replace(/(\d+(?:\.\d+)?)\s*ml\b/g, "$1 milliliters");
  s = s.replace(/(\d+(?:\.\d+)?)\s*L\b/g, "$1 liters");
  s = s.replace(/(\d+(?:\.\d+)?)\s*cm\b/g, "$1 centimeters");
  s = s.replace(/(\d+(?:\.\d+)?)\s*mm\b/g, "$1 millimeters");
  s = s.replace(/(\d+(?:\.\d+)?)\s*°?C\b/g, "$1 degrees Celsius");
  s = s.replace(/(\d+(?:\.\d+)?)\s*°?F\b/g, "$1 degrees Fahrenheit");
  s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, "$1 percent");

  // ── Vitals shortcuts — pronounce as words, not letters ───────────────
  s = s.replace(/\bSpO2\b/g, "S P O 2");
  s = s.replace(/\bSpO₂\b/g, "S P O 2");
  s = s.replace(/\bEtCO2\b/g, "end-tidal C O 2");
  s = s.replace(/\bEtCO₂\b/g, "end-tidal C O 2");
  s = s.replace(/\bPaCO2\b/g, "partial pressure C O 2");
  s = s.replace(/\bMAP\b/g, "map"); // "mean arterial pressure" → ElevenLabs reads "map" naturally
  s = s.replace(/\bBP\b/g, "B P");
  s = s.replace(/\bHR\b/g, "H R");
  s = s.replace(/\bBPM\b/gi, "B P M");
  s = s.replace(/\bRR\b/g, "respiratory rate");
  s = s.replace(/\bTOF\b/g, "T O F");
  s = s.replace(/\bBIS\b/g, "B I S"); // Bispectral index — letters
  s = s.replace(/\bMAC\b/g, "mac"); // syllable, not letters

  // ── BP read-back: "120/80" near a vital → "120 over 80" ─────────────
  s = s.replace(/(\d{2,3})\s*\/\s*(\d{2,3})\b/g, "$1 over $2");

  // ── Time-of-day stays as-is (ElevenLabs handles "06:48" fine) ───────

  // Collapse any double spaces introduced by the substitutions above.
  s = s.replace(/\s{2,}/g, " ").trim();

  return s;
}

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

    // Normalize medical strings (blood types, units, vitals) before
    // sending to ElevenLabs — see normalizeForTts above.
    const text = normalizeForTts(data.text);

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
      body: JSON.stringify({ text, model_id: "eleven_flash_v2_5" }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`ElevenLabs TTS error (${res.status}): ${detail}`);
    }

    const buffer = await res.arrayBuffer();
    return { audioBase64: Buffer.from(buffer).toString("base64") };
  });
