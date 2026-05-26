import { ImageOff } from "lucide-react";
import type { WidgetSize } from "../types";

interface DisplayImage {
  id: string;
  name: string;
  dataUrl: string;
}

interface Props {
  size: WidgetSize;
  caption?: string;
  image?: DisplayImage;
  emptyHint?: string;
}

export function ImageWidget({ caption, image, size, emptyHint }: Props) {
  if (!image) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
        <ImageOff className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
        <div className="text-xs font-light text-muted-foreground">
          {emptyHint ?? "Click to configure"}
        </div>
      </div>
    );
  }
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black">
      <img src={image.dataUrl} alt={image.name} className="max-h-full max-w-full object-contain" />
      {size !== "small" && caption && (
        <div className="absolute bottom-1 left-2 right-2 truncate font-mono text-[9px] uppercase tracking-[0.3em] text-white/70">
          {caption}
        </div>
      )}
    </div>
  );
}
