import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useArtiVoice, type ArtiVoiceCallbacks } from "./useArtiVoice";

type ArtiVoiceValue = ReturnType<typeof useArtiVoice>;

const ArtiVoiceContext = createContext<ArtiVoiceValue | null>(null);

interface ProviderProps {
  callbacks: ArtiVoiceCallbacks;
  children: ReactNode;
}

/**
 * Provides a single shared voice session for the whole Arti wall. Mounted
 * once at the route level so navigation between phases (sleep → home →
 * cases → preop) doesn't tear down or duplicate the ElevenLabs session.
 */
export function ArtiVoiceProvider({ callbacks, children }: ProviderProps) {
  const value = useArtiVoice(callbacks);
  // Memoize the object identity so consumers don't re-render unnecessarily
  // — but the underlying primitives still update.
  const memo = useMemo(
    () => value,
    [
      value.sessionStatus,
      value.isConnected,
      value.isAgentSpeaking,
      value.wakeListening,
      value.error,
      value.startSession,
      value.endSession,
      value.startWakeWord,
      value.stopWakeWord,
      value.wakeWordSupported,
    ],
  );
  return <ArtiVoiceContext.Provider value={memo}>{children}</ArtiVoiceContext.Provider>;
}

/** Returns the shared voice controls. Returns null when used outside provider. */
export function useArtiVoiceContext(): ArtiVoiceValue | null {
  return useContext(ArtiVoiceContext);
}
