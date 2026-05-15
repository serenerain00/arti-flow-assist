import { useEffect, useRef } from "react";
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, Underline } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (html: string) => void;
}

interface ToolDef {
  command: string;
  argument?: string;
  icon: typeof Bold;
  label: string;
}

const TOOLS: ToolDef[] = [
  { command: "bold", icon: Bold, label: "Bold" },
  { command: "italic", icon: Italic, label: "Italic" },
  { command: "underline", icon: Underline, label: "Underline" },
  { command: "formatBlock", argument: "<h2>", icon: Heading2, label: "Heading 2" },
  { command: "formatBlock", argument: "<h3>", icon: Heading3, label: "Heading 3" },
  { command: "insertUnorderedList", icon: List, label: "Bulleted list" },
  { command: "insertOrderedList", icon: ListOrdered, label: "Numbered list" },
];

export function PrefCardWysiwyg({ value, onChange }: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value !== lastEmittedRef.current) {
      el.innerHTML = value;
      lastEmittedRef.current = value;
    }
  }, [value]);

  const emit = () => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    lastEmittedRef.current = html;
    onChange(html);
  };

  const apply = (tool: ToolDef) => {
    editorRef.current?.focus();
    document.execCommand(tool.command, false, tool.argument);
    emit();
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-surface/40">
      <div className="flex flex-wrap items-center gap-1 border-b border-border/60 bg-surface-2/40 px-3 py-2">
        {TOOLS.map((tool, i) => (
          <button
            key={`${tool.command}-${tool.argument ?? i}`}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              apply(tool);
            }}
            title={tool.label}
            aria-label={tool.label}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors",
              "hover:bg-surface-3/80 hover:text-foreground",
            )}
          >
            <tool.icon className="h-4 w-4" strokeWidth={1.7} />
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        className={cn(
          "prose prose-invert min-h-[280px] max-w-none px-5 py-4 text-sm font-light leading-relaxed text-foreground focus:outline-none",
          "[&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-light",
          "[&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-medium",
          "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6",
          "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6",
          "[&_p]:my-1.5",
        )}
        data-placeholder="Start typing the preference card…"
      />
    </div>
  );
}
