// components/navbar.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/products", label: "Products" },
  { href: "/artisans", label: "Artisans" },
  { href: "/how-it-works", label: "How it works" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-1 font-display text-xl font-semibold tracking-tight">
          <span className="text-rust">Jua</span>
          <span className="text-charcoal">Link</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-charcoal/80 transition hover:text-charcoal"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <button
            aria-label="Search products"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-charcoal/70 transition hover:border-forest hover:text-forest"
          >
            <Search className="h-4 w-4" />
          </button>
          <Link href="/join-as-artisan" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Sell on JuaLink
          </Link>
          <Link href="/products" className={cn(buttonVariants({ variant: "primary", size: "sm" }))}>
            Explore products
          </Link>
        </div>

        <button className="md:hidden" aria-label="Toggle menu" onClick={() => setOpen((v) => !v)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-4">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm font-medium" onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <Link href="/join-as-artisan" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Sell on JuaLink
              </Link>
              <Link href="/products" className={cn(buttonVariants({ variant: "primary", size: "sm" }))}>
                Explore products
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}