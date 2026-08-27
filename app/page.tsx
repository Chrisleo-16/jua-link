import Image from "next/image";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing-navbar";
import { TornEdge } from "@/components/torn-edge";
import { fetchProducts, fetchCategories } from "@/lib/products/queries";

export default async function LandingPage() {
  const [categories, { products: featured }] = await Promise.all([
    fetchCategories(),
    fetchProducts({ page: 1 }),
  ]);

  // One representative product per category, for the category cards.
  const categoryCards = categories.slice(0, 3).map((c) => {
    const sample = featured.find((p) => p.category?.slug === c.slug);
    return {
      slug: c.slug,
      name: c.name,
      image: sample?.primary_image_url,
      priceFrom: sample?.price_from,
    };
  });

  // Real products with photos, for the journal/collage strip.
  const journalProducts = featured.filter((p) => p.primary_image_url).slice(0, 2);

  return (
    <div className="bg-background text-charcoal">
      {/* Announcement ticker
      <div className="overflow-hidden bg-rust py-2 text-white">
        <div className="marquee-track flex w-[200%] gap-10 whitespace-nowrap text-xs font-semibold uppercase tracking-wide">
          {Array(2).fill(0).map((_, i) => (
            <div key={i} className="flex gap-10">
              <span>Verified artisans only</span>
              <span>Nairobi-wide delivery</span>
              <span>Pay on completion</span>
              <span>Free quotes within 24hrs</span>
            </div>
          ))}
        </div>
      </div> */}

      <LandingNavbar />

      {/* Hero — unchanged */}
      <section className="relative grid gap-0 pt-28 md:grid-cols-2 md:pt-32">
        <div className="relative h-[420px] md:h-[560px]">
          <Image
            src="/images/hero-workshop.jpg"
            alt="A Jua Kali artisan welding a steel gate"
            fill
            priority
            className="object-cover"
          />
          <span className="absolute left-6 top-6 rounded-full bg-background px-3 py-1 text-xs font-semibold uppercase tracking-wide text-charcoal shadow-sm">
            Trusted since Jua Kali began
          </span>
        </div>

        <div className="relative flex flex-col justify-center gap-6 bg-background px-6 py-12 md:px-14">
          <h1 className="font-display text-[13vw] uppercase leading-[0.85] text-charcoal md:text-[64px]">
            From the
            <br />
            workshop to
            <br />
            <span className="text-rust">your doorstep</span>
          </h1>
          <p className="max-w-sm text-base text-charcoal/70">
            JuaLink connects you directly with Nairobi&apos;s Jua Kali makers —
            gates, furniture, doors, lockers and repairs, built by hand and
            backed by a real name.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="#work"
              className="rounded-full bg-charcoal px-6 py-3 text-sm font-semibold text-white transition hover:bg-charcoal/90"
            >
              Explore work
            </Link>
            <Link
              href="/join-as-artisan"
              className="rounded-full border border-charcoal px-6 py-3 text-sm font-semibold text-charcoal transition hover:bg-muted"
            >
              Join as an artisan
            </Link>
          </div>

          <div className="absolute -bottom-8 right-6 hidden w-44 rotate-3 rounded-xl border border-border bg-background p-3 shadow-md md:block">
            <div className="relative mb-2 h-20 w-full overflow-hidden rounded-md">
              <Image src="/images/reveal-metalwork.jpg" alt="Gate sample" fill className="object-cover" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-forest">
              Verified · Gikomba
            </p>
          </div>
        </div>
      </section>
      <TornEdge color="#FAF8F4" />

      {/* Trust line */}
      <section className="border-y border-border bg-background px-6 py-16 text-center md:px-12">
        <p className="mx-auto max-w-3xl font-display text-2xl uppercase leading-snug text-charcoal md:text-4xl">
          We connect you with real makers, verify their work, and stand behind
          every commission.
        </p>
      </section>

      {/* Category cards — real categories + real sample product photos */}
      <section id="work" className="px-6 py-20 md:px-12">
        <h2 className="mb-10 font-display text-3xl uppercase text-charcoal">
          Popular categories
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {categoryCards.map((c, i) => (
            <div
              key={c.slug}
              className="flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-sm"
            >
              <div className="flex items-center justify-between px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-charcoal/50">
                <span>{String(i + 1).padStart(3, "0")}</span>
                <span>
                  {c.priceFrom ? `Est. from KSh ${c.priceFrom.toLocaleString()}` : "Price on request"}
                </span>
              </div>
              <div className="relative m-4 h-40 overflow-hidden rounded-xl bg-muted">
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt={c.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No photo yet
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between px-4 pb-4">
                <span className="font-display text-lg uppercase text-charcoal">
                  {c.name}
                </span>
                <Link
                  href={`/products?category=${c.slug}`}
                  className="rounded-full bg-charcoal px-4 py-2 text-xs font-semibold uppercase text-white transition hover:bg-rust"
                >
                  Explore
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Journal + map — real product photos */}
      <section id="artisans" className="bg-charcoal px-6 py-20 text-background md:px-12">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <span className="rounded-full bg-rust px-3 py-1 text-xs font-semibold uppercase text-white">
              JuaLink journal
            </span>
            <h2 className="mt-4 font-display text-3xl uppercase leading-tight md:text-4xl">
              Meet the workshops behind the work
            </h2>
            <div className="mt-8 flex gap-4">
              {journalProducts.map((p, i) => (
                <div
                  key={p.id}
                  className={`relative w-40 rounded-lg bg-background p-2 shadow-lg ${
                    i % 2 === 0 ? "-rotate-3" : "rotate-3"
                  }`}
                >
                  <div className="relative h-40 w-full overflow-hidden rounded bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.primary_image_url!}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="mt-2 px-1 pb-1 text-[11px] text-charcoal/70">
                    {p.name} · {p.location}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-background/5 p-6">
            <p className="mb-6 text-sm uppercase tracking-wide text-gold">
              Where our artisans work from
            </p>
            <ul className="space-y-4 text-lg font-display uppercase">
              <li className="flex items-center justify-between border-b border-white/10 pb-3">
                Gikomba <span className="text-sm text-white/50">Metalwork &amp; gates</span>
              </li>
              <li className="flex items-center justify-between border-b border-white/10 pb-3">
                Kamukunji <span className="text-sm text-white/50">Furniture</span>
              </li>
              <li className="flex items-center justify-between pb-1">
                Kariokor <span className="text-sm text-white/50">Doors &amp; lockers</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Demand distribution */}
      <section className="px-6 py-20 md:px-12">
        <h2 className="mb-2 font-display text-3xl uppercase text-charcoal">
          Most requested work
        </h2>
        <p className="mb-10 max-w-md text-charcoal/60">
          Gates lead demand at 35%, followed by furniture at 28%, doors at
          22%, and repairs at 15%.
        </p>
        <div className="flex flex-wrap items-end gap-6">
          {[
            { label: "Gates", pct: 35, color: "bg-rust text-white" },
            { label: "Furniture", pct: 28, color: "bg-gold text-charcoal" },
            { label: "Doors", pct: 22, color: "bg-forest text-white" },
            { label: "Repairs", pct: 15, color: "bg-charcoal text-white" },
          ].map((d) => (
            <div
              key={d.label}
              className={`flex flex-col items-center justify-center rounded-full ${d.color}`}
              style={{ height: `${100 + d.pct}px`, width: `${100 + d.pct}px` }}
            >
              <span className="font-display text-2xl">{d.pct}%</span>
              <span className="text-xs font-semibold uppercase">{d.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-border bg-muted px-6 py-16 text-center md:px-12">
        <h2 className="mb-6 font-display text-3xl uppercase text-charcoal">
          Ready to commission real work?
        </h2>
        <Link
          href="/products"
          className="inline-block rounded-full bg-rust px-8 py-4 text-sm font-semibold uppercase text-white transition hover:bg-rust/90"
        >
          See all products
        </Link>
      </section>
    </div>
  );
}