import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useArtiVoice, type ArtiVoiceCallbacks } from "./useArtiVoice";

type ArtiVoiceValue = ReturnType<typeof useArtiVoice> & {
  artiNapping: boolean;
  wakeArti: () => void;
};

const ArtiVoiceContext = createContext<ArtiVoiceValue | null>(null);

interface ProviderProps {
  callbacks: ArtiVoiceCallbacks;
  artiNapping: boolean;
  wakeArti: () => void;
  children: ReactNode;
}

export function ArtiVoiceProvider({ callbacks, artiNapping, wakeArti, children }: ProviderProps) {
  const voice = useArtiVoice(callbacks);
  const memo = useMemo(
    () => ({ ...voice, artiNapping, wakeArti }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      voice.listening,
      voice.isSpeaking,
      voice.error,
      voice.speak,
      voice.stopSpeaking,
      voice.sendCommand,
      voice.startListening,
      voice.stopListening,
      voice.activateSession,
      voice.wakeWordSupported,
      artiNapping,
      wakeArti,
    ],
  );
  return <ArtiVoiceContext.Provider value={memo}>{children}</ArtiVoiceContext.Provider>;
}

export function useArtiVoiceContext(): ArtiVoiceValue | null {
  return useContext(ArtiVoiceContext);
}
