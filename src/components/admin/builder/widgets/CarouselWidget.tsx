import { useEffect, useState } from "react";
import { Images } from "lucide-react";
import type { WidgetSize } from "../types";

interface DisplayImage {
  id: string;
  name: string;
  dataUrl: string;
}

interface Props {
  size: WidgetSize;
  images: DisplayImage[];
  emptyHint?: string;
}

const CYCLE_MS = 4000;

export function CarouselWidget({ images, size, emptyHint }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [images.length]);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [images.length]);

  if (images.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
        <Images className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
        <div className="text-xs font-light text-muted-foreground">
          {emptyHint ?? "Click to configure"}
        </div>
      </div>
    );
  }

  const current = images[index];

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black">
      <img
        src={current.dataUrl}
        alt={current.name}
        className="max-h-full max-w-full object-contain transition-opacity duration-500"
      />
      {size !== "small" && images.length > 1 && (
        <div className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/80">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
