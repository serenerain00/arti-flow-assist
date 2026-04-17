import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic } from "lucide-react";

interface Props {
  placeholder?: string;
  onSubmit: (text: string) => void;
  /** Suggestion chips shown above the input. */
  suggestions?: string[];
  autoFocus?: boolean;
}

/**
 * Conversational input for talking to Arti. Renders a pill input with optional
 * suggestion chips. Keep it dumb — intent parsing happens in the parent route.
 */
export function PromptBar({ placeholder, onSubmit, suggestions = [], autoFocus }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      // Defer focus a tick so the fade-in doesn't fight the caret blink.
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-3">
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => submit(s)}
              className="rounded-full border border-border bg-surface-2/60 px-3.5 py-1.5 text-xs font-light text-muted-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="group flex w-full items-center gap-2 rounded-full border border-border bg-surface/80 px-2 py-2 backdrop-blur-xl transition-colors focus-within:border-primary/50"
      >
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          aria-label="Voice input (placeholder)"
          tabIndex={-1}
        >
          <Mic className="h-4 w-4" strokeWidth={1.6} />
        </button>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder ?? "Ask Arti…"}
          className="min-w-0 flex-1 bg-transparent px-1 text-sm font-light text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
          aria-label="Send"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2.2} />
        </button>
      </form>
    </div>
  );
}
