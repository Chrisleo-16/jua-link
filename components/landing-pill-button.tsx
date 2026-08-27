// components/landing-pill-button.tsx — filled button now uses cream text on brown,
// ghost button now uses dark border/text instead of cream
import Link from "next/link";
import { cn } from "@/lib/utils";

export function PillButtonFilled({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-[36px] bg-bark-brown px-6 py-3.5 font-editorial text-xs font-medium uppercase text-warm-cream transition hover:bg-bark-brown/80 md:text-sm",
        className
      )}
    >
      {children}
    </Link>
  );
}

export function PillButtonGhost({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-[22.5px] border border-walnut-shadow bg-transparent px-0 py-[7.5px] font-editorial text-xs font-medium uppercase text-walnut-shadow transition hover:opacity-70 md:text-sm",
        className
      )}
    >
      {children}
    </Link>
  );
}