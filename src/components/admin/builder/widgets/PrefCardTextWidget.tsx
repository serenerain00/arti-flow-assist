import { FileText } from "lucide-react";
import type { WidgetSize } from "../types";

interface Props {
  size: WidgetSize;
  html?: string;
  caption?: string;
  emptyHint?: string;
}

export function PrefCardTextWidget({ html, caption, size, emptyHint }: Props) {
  if (!html || !html.trim()) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
        <FileText className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
        <div className="text-xs font-light text-muted-foreground">
          {emptyHint ?? "Click to configure"}
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full w-full flex-col px-4 py-4">
      {size === "large" && caption && (
        <div className="mb-2 truncate font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          {caption}
        </div>
      )}
      <div
        className={
          "prose prose-invert min-w-0 max-w-none overflow-y-auto text-sm font-light leading-relaxed text-foreground " +
          "[&_h2]:mb-1 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-light " +
          "[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-medium " +
          "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 " +
          "[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 " +
          "[&_p]:my-1"
        }
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
