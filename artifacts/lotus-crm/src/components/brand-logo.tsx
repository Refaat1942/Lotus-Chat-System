import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const DEFAULT_LOGO = "/brand/lotus-logo-256.webp";
export const DEFAULT_LOGO_LARGE = "/brand/lotus-logo-512.webp";

/**
 * Company logo. Shows the logo uploaded in Settings → Branding; until one is
 * uploaded it shows the default Lotus Pharmacies logo bundled with the app.
 * Empty white/transparent margins around an uploaded logo are trimmed away
 * automatically, so the mark fills the space it is given.
 */
export function BrandLogo({
  logoUrl,
  name,
  className,
  imgClassName,
  large,
}: {
  logoUrl?: string | null;
  name: string;
  className?: string;
  imgClassName?: string;
  large?: boolean;
}) {
  const trimmed = useTrimmedLogo(logoUrl);
  if (logoUrl) {
    return (
      <img
        src={trimmed ?? logoUrl}
        alt={name}
        className={cn("object-contain", imgClassName ?? className)}
        data-testid="brand-logo"
      />
    );
  }
  return (
    <img
      src={large ? DEFAULT_LOGO_LARGE : DEFAULT_LOGO}
      alt={name}
      className={cn("object-contain rounded-full", className)}
      data-testid="brand-logo"
      decoding="async"
    />
  );
}

export function BrandTagline({ className }: { className?: string }) {
  return (
    <p className={cn("leading-snug", className)}>
      <span className="block">Caring for Your Health</span>
      <span className="block font-arabic" lang="ar" dir="rtl">نهتم بصحتك</span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Margin trimming for uploaded logos (runs once per logo, cached in memory).

const trimCache = new Map<string, Promise<string | null>>();
const MAX_SIDE = 1024;

function trimLogo(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w0 = img.naturalWidth || img.width;
        const h0 = img.naturalHeight || img.height;
        if (!w0 || !h0) return resolve(null);
        const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
        const w = Math.max(1, Math.round(w0 * scale));
        const h = Math.max(1, Math.round(h0 * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        let top = h, left = w, right = -1, bottom = -1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const a = data[i + 3];
            // "Empty" = (nearly) transparent or (nearly) white.
            if (a < 24 || (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240)) continue;
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
          }
        }
        if (right < 0) return resolve(null);
        const pad = Math.round(Math.max(right - left, bottom - top) * 0.04);
        left = Math.max(0, left - pad);
        top = Math.max(0, top - pad);
        right = Math.min(w - 1, right + pad);
        bottom = Math.min(h - 1, bottom + pad);
        const cw = right - left + 1;
        const ch = bottom - top + 1;
        // Nothing worth trimming (less than 5% on every side).
        if (cw > w * 0.9 && ch > h * 0.9) return resolve(null);
        const out = document.createElement("canvas");
        out.width = cw;
        out.height = ch;
        out.getContext("2d")?.drawImage(canvas, left, top, cw, ch, 0, 0, cw, ch);
        resolve(out.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function useTrimmedLogo(src?: string | null): string | null {
  const [out, setOut] = useState<{ src: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    let p = trimCache.get(src);
    if (!p) {
      p = trimLogo(src);
      trimCache.set(src, p);
    }
    void p.then((url) => {
      if (alive) setOut({ src, url });
    });
    return () => {
      alive = false;
    };
  }, [src]);
  return out && out.src === src ? out.url : null;
}
