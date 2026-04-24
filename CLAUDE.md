# Arti Flow Assist — Claude Code Context

## What this is

**Arti** is an AI-powered OR (operating room) wall display. It is a **prototype/engineering reference** — not a production medical system. The goal is to demonstrate how voice AI can reduce cognitive load for surgical teams: time-outs, instrument counts, case schedules, team rosters, and role-specific dashboards.

Owner: Melissa Casole. Stack originated from a Lovable scaffold.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | TanStack Start (React 19 + TypeScript) |
| Routing | TanStack Router (file-based, `src/routes/index.tsx` is the only route) |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix primitives) |
| Animation | Framer Motion (screen transitions), GSAP (orb animations) |
| Voice in | Browser `SpeechRecognition` API (Chrome) |
| AI | Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) via `@anthropic-ai/sdk` |
| TTS out | ElevenLabs (`eleven_flash_v2_5` — fastest model) |
| Carousel | `embla-carousel-react` (ImageLightboxModal) |
| Server fns | TanStack Start `createServerFn` (keeps API keys server-side) |

---

## Voice pipeline

```
Browser mic (SpeechRecognition, continuous)
  → handleTranscript() in useArtiVoice.ts
      → wake-word filter: /\barti(?:e|y)?\b/i  (required for first voice command)
      → 10-second follow-up window (armed after each Arti response; no wake word needed)
      → processingRef prevents concurrent Claude calls
  → processVoiceCommand() server fn  ← arti.ts
      → Claude Haiku, max_tokens: 128, temperature: 0, tool_use
      → navigation/view/scroll tools → SILENT (no spoken output; screen change is confirmation)
      → action tools (counts, checklist, alerts, role) → second turn (max_tokens: 24) for ≤5-word confirmation
  → executeToolCall() dispatches tool results to UI callbacks
  → speakText() server fn  ← elevenlabs.ts
      → ElevenLabs eleven_flash_v2_5 → base64 MP3 → Audio element
```

**Silent by default.** Arti does NOT auto-greet on wake. It speaks only when a user prompt (voice or text) is submitted and Claude returns a response.

**Idle auto-sleep.** 60-second idle timer starts on wake. Any user activity resets it. On expiry, Arti says *"I haven't heard from you in almost a minute, I'm going to take a nap."* then transitions to `phase = "sleep"`.

---

## App state machine

`src/routes/index.tsx` owns a single `phase` state:

```
sleep → waking → greeting → home → cases → preop
```

- **sleep / waking / greeting** share the same `SleepScreen` component (keyed as `"sleep"` in AnimatePresence to avoid remount mid-animation)
- **home** → `HomeDashboard`
- **cases** → `CaseListScreen`
- **preop** → `AwakeDashboard` (the main surgical OR view)

Phase transitions happen via Claude tool calls (`navigate_home`, `navigate_cases`, `open_case`, `wake`, `sleep`) or direct user interaction (case selection, back buttons, orb tap).

---

## Key architecture patterns

### Ref bridges (the most important pattern)
`stableCallbacks` in `ArtiWallRoot` is a `useMemo([], [])` — it never re-renders. To give it access to live state from child components, we use mutable refs:

- `navCallbacksRef` — navigation actions (onWake, onGoHome, etc.), written by `ArtiWall` each render
- `dashboardActionsRef` — OR dashboard tool handlers, written by `AwakeDashboard` while mounted
- `dashboardContextRef` — live UI state snapshot getter, written by `AwakeDashboard`
- `contextRef` — full Claude context getter, written by `ArtiWall` each render
- `scrollActionsRef` — scroll control, written by `ArtiWall` each render
- `idleResetRef` — resets the 60s idle timer, written by `ArtiWall` each render

### Tool dispatch flow
`ArtiVoiceCallbacks` (interface in `useArtiVoice.ts`) defines all voice→UI callbacks. `stableCallbacks` implements them by delegating through the refs above. `executeToolCall()` maps Claude tool names → callbacks.

### Dashboard context
`AwakeDashboard` writes a getter to `dashboardContextRef` (via `useEffect` on live state). `ArtiWall` appends it to the Claude context string so the AI always knows the current role view, time-out status, instrument counts, etc.

---

## File map

```
src/
  routes/
    index.tsx              # Only route. ArtiWallRoot (provider) + ArtiWall (state machine).
                           # Owns: phase, activeCase, idle timer, scroll impl, ref bridges.

  hooks/
    useArtiVoice.ts        # Voice hook: SpeechRecognition, Claude calls, TTS, session mgmt.
                           # Exports: ArtiVoiceCallbacks, ArtiToolResult, all ID types.
    ArtiVoiceContext.tsx   # Provider wrapper so any component can call useArtiVoiceContext().

  server/
    arti.ts                # processVoiceCommand() — Claude tool definitions + two-turn handler.
    elevenlabs.ts          # speakText() — ElevenLabs TTS server fn.

  components/arti/
    cases.ts               # TODAY_CASES (5 mock cases), PATIENT_CLINICAL (per-case clinical data),
                           # PatientClinical interface, STATUS_META.
                           # PatientClinical includes: procedureSteps[], implantPlan[] per case.

    AwakeDashboard.tsx     # Main OR dashboard. Owns: role, instrument counts, time-out state,
                           # alerts, lightbox, quad view. Registers dashboardActionsRef.

    AnesthesiaPanel.tsx    # Role view: allergies, anesthesia plan, meds, airway, labs,
                           # machine check. Reads PATIENT_CLINICAL[activeCase.id].
    ScrubTechPanel.tsx     # Role view: instrument counts (big numerals), table layout images,
                           # opening checklist, implant availability.
    SurgeonPanel.tsx       # Role view: procedure steps (c.procedureSteps), case summary,
                           # implant plan (c.implantPlan), surgeon notes (c.notes).
    TimeOutPanel.tsx       # Nurse view: surgical time-out checklist (4 items).
    InstrumentCount.tsx    # Nurse view: raytec/lap/needle/blade/clamps count controls.
    AlertStack.tsx         # Nurse view: advisory alerts with tier-based dismiss rules.
    TeamRoster.tsx         # Nurse view: OR team members.
    PreferenceCard.tsx     # Surgeon preference card + PREF_CARD_IMAGES lightbox export.
    RoleSwitcherBar.tsx    # Tab bar: nurse / scrub / surgeon / anesthesia.

    ArtiInvoker.tsx        # Floating text input + mic orb + suggestion chips.
                           # wasListeningRef guards auto-close so brief mic restarts
                           # don't collapse the panel.
    ImageLightboxModal.tsx # Full-screen Embla carousel. 64px nav arrows (gloved hands).
                           # Zoom toggle, keyboard nav, dot indicators.
    PatientDetailsModal.tsx# Full patient modal (demographics, allergies, meds, labs, consents).
    CaseHeader.tsx         # Top banner: procedure name, patient, countdown/status, Patient Info btn.
                           # Countdown: H:MM:SS when ≥1h, MM:SS when <1h.
    QuadView.tsx           # Split-screen overlay: timeout + instruments + alerts + team.
    HowToVideoModal.tsx    # Embedded surgical how-to video by keyword.

    SleepScreen.tsx        # Sleep/waking/greeting phase UI (orb, wake animation).
    HomeDashboard.tsx      # Home screen (post-wake landing).
    CaseListScreen.tsx     # Today's 5-case schedule list.

  skills/
    personality.md         # Arti system prompt. Read at server startup by arti.ts.
                           # See "Arti personality" section below.
```

---

## Mock data

Five surgical cases in `cases.ts` (`c-001` through `c-005`), all OR 326, Dr. Anika Patel:

| ID | Patient | Procedure | Status |
|---|---|---|---|
| c-001 | Helena Voss 58F | Arthroscopic RCR (Left) | completed |
| c-002 | Marcus Chen 62M | Reverse TSA (Right) | next |
| c-003 | Priya Raman 44F | SLAP Repair + Biceps Tenodesis (Right) | scheduled |
| c-004 | Jonas Albrecht 37M | Bankart Repair (Left) | delayed |
| c-005 | Linnea Park 51F | Subacromial Decompression (Right) | scheduled |

`PATIENT_CLINICAL` record keyed by case ID has: dob, sex, height, weight, bmi, bloodType, npo, allergies (agent/reaction/severity), medications, conditions, labs (label/value/flag), consents, notes, airway (mallampati/difficult), anesthesiaPlan.

---

## Claude tools (arti.ts)

| Tool | Purpose |
|---|---|
| `wake` | Wake from sleep |
| `navigate_home` / `navigate_cases` | Screen nav |
| `open_case` | Open case by name / keyword / "next" |
| `sleep` | Put Arti to sleep |
| `toggle_timeout_item` | Check/uncheck time-out item (patient/site/procedure/allergies) |
| `adjust_instrument_count` | ±delta on raytec/lap/needle/blade/clamps |
| `toggle_sterile_cockpit` | Enable/disable sterile cockpit mode |
| `dismiss_alert` | Dismiss non-critical alert by index |
| `open_quad_view` / `focus_quad_panel` / `close_quad_view` | Quad overlay |
| `open_how_to_video` | Surgical how-to video by keyword |
| `show_preference_card` | Scroll to preference card |
| `show_preference_card_layout_images` | Open table layout lightbox |
| `switch_role` | Switch dashboard view (nurse/scrub/surgeon/anesthesia) |
| `open_patient_details` | Open patient details modal |
| `scroll` | Scroll screen (direction: up/down/top/bottom, speed: slow/normal/fast, continuous: bool) |
| `stop_scroll` | Stop continuous scroll |

---

## Environment variables

```
ANTHROPIC_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
```

---

## Key behaviors / invariants

- **No auto-greet** — Arti never speaks unprompted. Only responds to user input.
- **Idle timer** — 60s from last activity → spoken warning → `phase = "sleep"`.
- **Mic auto-restarts** — `SpeechRecognition.onend` restarts if `recognitionRef.current` is set. Only fatal errors (`not-allowed`, `audio-capture`) stop the mic.
- **Critical alerts cannot be dismissed** — `AlertStack` tier === "Critical" returns `{ ok: false }`.
- **`processingRef`** — prevents concurrent Claude calls. Overlapping transcripts are dropped.
- **`data-scroll` attribute** — marks the scrollable container (`<main data-scroll>` in AwakeDashboard). Scroll tool targets this element, falls back to `document.documentElement`.
- **Second Claude turn** — only fires when tools were called but no text was returned in the first response. Provides spoken confirmation.

---

## Arti personality (skills/personality.md)
## Hard Interaction Guardrails (Critical)

Arti is strictly reactive. It does not think, act, or speak unless explicitly prompted by a user.

### Absolute Rules

- Arti MUST remain completely silent unless:
  - A clear, intentional user command is detected
  - The wake word ("Arti") is used OR an active session is already in progress

- Arti MUST NOT:
  - Speak unprompted
  - Continue a conversation unless directly addressed again
  - Fill silence with suggestions or commentary
  - React to ambient noise, partial phrases, or unclear input
  - Trigger UI actions without a direct command
  - Repeat or expand on previous responses unless explicitly asked

- If input is unclear, partial, or does not contain a clear command:
  → Do nothing (remain silent)

- If a command is ambiguous:
  → Ask ONE short clarification question, then stop

- If no valid intent is detected:
  → Do nothing (no response)

---

### Session Discipline

- Each user command is treated as a single, isolated interaction
- Arti does NOT assume follow-up intent unless explicitly stated
- Arti does NOT “stay in conversation mode” beyond the defined session window
- Even within the session window, Arti only responds when directly addressed

---

### UI Control Discipline

- Arti only triggers tools when a user explicitly requests an action
- Arti MUST NOT proactively navigate, update, or manipulate the UI
- Words like "show", "open", "switch", "display" must be clearly present in the command
- If not explicitly requested → do not act
### Two modes
| | Standard (cockpit OFF) | Cockpit (cockpit ON) |
|---|---|---|
| Tone | Friendly, personable, warm, may use light humor | Strictly clinical, no personality, no variation |
| Phrasing | Natural variation, slight warmth | Direct, precise, functional only |
| Suggestions | Allowed (≤1 sentence) | Suppressed entirely |

Mode is set by the `toggle_sterile_cockpit` tool / sterile cockpit button. Cockpit mode overrides all personality behaviors.

### Core response rules (both modes)
- Default to **one short sentence**. Never exceed two unless essential.
- Confirmations ≤ 5 words: "Done." / "Counts updated." / "Allergies shown."
- Never narrate intent — execute the tool first, then confirm briefly.
- No filler: no "Let me", "I'll go ahead", "Here's what I found".
- Never fabricate patient, procedural, or count data.
- If data is missing → "I don't have that."
- Humor is **never** allowed during: time-out, counts, alerts, or any safety interaction.

### On-demand greetings
Triggered only by explicit request ("say hello to Alex", "greet Dr. Chen", "welcome Jamie").
- Standard mode: warm, varied — "Hey Alex, good to have you in the room."
- Cockpit mode: short, neutral — "Hello, Dr. Chen."
- Never initiate greetings unprompted.

### Priority hierarchy
1. Patient safety
2. Accuracy
3. Speed and clarity
4. Minimal cognitive load

---

## Dev commands

```bash
npm run dev      # start dev server
npx tsc --noEmit # type-check (run before reporting changes as done)
npm run lint     # eslint
```
