"use client";

import Link from "next/link";

const links = [
  { href: "#work", label: "Our work" },
  { href: "#artisans", label: "Artisans" },
  { href: "/track-order", label: "Track order" },
];

export function LandingNavbar() {
  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <header className="flex w-full max-w-4xl items-center justify-between gap-4 rounded-full border border-border bg-background/90 px-3 py-2 shadow-sm backdrop-blur-md">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full px-3 py-1.5 font-display text-sm uppercase tracking-wide text-charcoal"
        >
          Jua<span className="text-rust">Link</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-charcoal/70 transition hover:bg-muted hover:text-charcoal"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/join-as-artisan"
          className="rounded-full bg-rust px-4 py-2 text-sm font-semibold text-white transition hover:bg-rust/90"
        >
          Join as artisan
        </Link>
      </header>
    </div>
  );
}