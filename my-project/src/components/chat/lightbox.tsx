"use client";

// Fullscreen image viewer.

import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface LightboxProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

export function Lightbox({ src, alt, onClose }: LightboxProps) {
  return (
    <Dialog open={src != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[96vw] gap-0 border-none bg-black/90 p-2 sm:max-w-[90vw]"
        onClick={onClose}
      >
        <DialogTitle className="sr-only">Image preview</DialogTitle>
        <DialogDescription className="sr-only">
          Full screen image viewer. Click anywhere or press escape to close.
        </DialogDescription>
        {src && (
          <div className="relative flex items-center justify-center">
            <img
              src={src}
              alt={alt || "Shared image"}
              className="max-h-[85vh] max-w-full rounded object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <a
              href={src}
              download
              target="_blank"
              rel="noreferrer"
              aria-label="Download image"
              className="absolute top-2 right-2 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="h-5 w-5" />
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
