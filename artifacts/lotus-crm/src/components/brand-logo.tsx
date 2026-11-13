import { cn } from "@/lib/utils";

export const DEFAULT_LOGO = "/brand/lotus-logo-256.webp";
export const DEFAULT_LOGO_LARGE = "/brand/lotus-logo-512.webp";

/**
 * Company logo. Shows the logo uploaded in Settings → Branding; until one is
 * uploaded it shows the default Lotus Pharmacies logo bundled with the app.
 * Uploaded logos are shown uncropped (object-contain).
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
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
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
