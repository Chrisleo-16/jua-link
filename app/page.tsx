import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <section className="text-center">
        <h1 className="font-display text-4xl font-semibold text-charcoal sm:text-5xl">
          Find trusted local makers.
          <br />
          Request custom products with confidence.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          JuaLink connects customers with Jua Kali artisans making gates, furniture, doors,
          desks, lockers, repairs, and more.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button variant="primary" size="lg">
            <Link href="/products">Explore products</Link>
          </Button>
          <Button variant="outline" size="lg">
            <Link href="/join-as-artisan">Join as an artisan</Link>
          </Button>
        </div>
      </section>

      {/* TODO next phase: search bar, featured categories, featured products,
          "how it works", "why JuaLink" — see concept brief section 5. */}
    </main>
  );
}
