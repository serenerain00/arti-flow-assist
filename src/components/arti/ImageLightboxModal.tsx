import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LightboxImage {
  src: string;
  alt: string;
  label?: string;
  caption?: string;
}

export interface LightboxHandle {
  scrollNext: () => void;
  scrollPrev: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleZoom: () => void;
  isZoomed: () => boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  images: LightboxImage[];
  initialIndex?: number;
  title?: string;
}

export const ImageLightboxModal = forwardRef<LightboxHandle, Props>(function ImageLightboxModal(
  { open, onClose, images, initialIndex = 0, title }: Props,
  ref,
) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    startIndex: initialIndex,
    loop: images.length > 1,
  });
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!emblaApi || !open) return;
    emblaApi.scrollTo(initialIndex, true);
    setSelectedIndex(initialIndex);
    setZoomed(false);
  }, [emblaApi, initialIndex, open]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setZoomed(false);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") emblaApi?.scrollPrev();
      if (e.key === "ArrowRight") emblaApi?.scrollNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, emblaApi]);

  useImperativeHandle(
    ref,
    () => ({
      scrollNext: () => emblaApi?.scrollNext(),
      scrollPrev: () => emblaApi?.scrollPrev(),
      zoomIn: () => setZoomed(true),
      zoomOut: () => setZoomed(false),
      toggleZoom: () => setZoomed((z) => !z),
      isZoomed: () => zoomed,
    }),
    [emblaApi, zoomed],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="lightbox-root"
          role="dialog"
          aria-modal
          aria-label={title ?? "Image viewer"}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: "tween", duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 flex flex-col bg-black/94 backdrop-blur-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-5 shrink-0">
            <div>
              {title && (
                <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary">
                  {title}
                </p>
              )}
              <p className="mt-0.5 text-sm font-light text-white/40">
                {selectedIndex + 1} / {images.length}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomed((z) => !z)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white/50 transition-all hover:border-white/30 hover:text-white"
                aria-label={zoomed ? "Zoom out" : "Zoom in"}
              >
                {zoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
              </button>
              <button
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white/50 transition-all hover:border-white/30 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Carousel area */}
          <div className="relative flex min-h-0 flex-1 items-center">
            {/* Prev arrow — 64px target for gloved hands */}
            {images.length > 1 && (
              <button
                onClick={() => emblaApi?.scrollPrev()}
                className="absolute left-4 z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white/50 transition-all hover:border-white/25 hover:bg-black/70 hover:text-white"
                aria-label="Previous"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
            )}

            <div className="overflow-hidden w-full px-24" ref={emblaRef}>
              <div className="flex">
                {images.map((img, i) => (
                  <div
                    key={i}
                    className="min-w-0 flex-[0_0_100%] flex flex-col items-center justify-center gap-5 py-4"
                  >
                    <div
                      className={cn(
                        "overflow-hidden rounded-2xl border border-white/10 transition-transform duration-500 ease-out",
                        zoomed ? "cursor-zoom-out scale-[1.7]" : "cursor-zoom-in scale-100",
                      )}
                      onClick={() => setZoomed((z) => !z)}
                    >
                      <img
                        src={img.src}
                        alt={img.alt}
                        className="block max-h-[58vh] w-auto select-none object-contain"
                        draggable={false}
                      />
                    </div>

                    {(img.label || img.caption) && (
                      <figcaption className="text-center">
                        {img.label && (
                          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                            {img.label}
                          </p>
                        )}
                        {img.caption && (
                          <p className="mt-1 text-sm font-light text-white/40">{img.caption}</p>
                        )}
                      </figcaption>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {images.length > 1 && (
              <button
                onClick={() => emblaApi?.scrollNext()}
                className="absolute right-4 z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white/50 transition-all hover:border-white/25 hover:bg-black/70 hover:text-white"
                aria-label="Next"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            )}
          </div>

          {/* Dot indicators */}
          {images.length > 1 && (
            <div className="flex shrink-0 items-center justify-center gap-2 py-6">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => emblaApi?.scrollTo(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === selectedIndex ? "w-6 bg-primary" : "w-1.5 bg-white/20 hover:bg-white/40",
                  )}
                  aria-label={`Image ${i + 1}`}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
});
