import Link from "next/link";
import { fetchProducts, fetchCategories } from "@/lib/products/queries";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface SearchParams {
  q?: string;
  category?: string;
  location?: string;
  min?: string;
  max?: string;
  custom?: string;
  page?: string;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1");

  const [categories, { products, hasMore }] = await Promise.all([
    fetchCategories(),
    fetchProducts({
      search: params.q,
      categorySlug: params.category,
      location: params.location,
      minPrice: params.min ? Number(params.min) : undefined,
      maxPrice: params.max ? Number(params.max) : undefined,
      customOnly: params.custom === "true",
      page,
    }),
  ]);

  // Build the "Load more" link by carrying forward every current filter
  // and incrementing page — no client JS required for pagination to work.
  const nextPageParams = new URLSearchParams(params as Record<string, string>);
  nextPageParams.set("page", String(page + 1));

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold text-charcoal">Explore products</h1>
      <p className="mt-1 text-muted-foreground">
        Browse standard and custom-made items from verified Jua Kali artisans.
      </p>

      {/* Filters — a plain GET form so the whole thing works without JS,
          and every filter is shareable as a URL. */}
      <form className="mt-6 grid grid-cols-1 gap-3 rounded-lg border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Search products"
          className="col-span-1 h-11 rounded-md border border-border px-3 text-sm sm:col-span-2 lg:col-span-2"
        />
        <select name="category" defaultValue={params.category ?? ""} className="h-11 rounded-md border border-border px-3 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          name="location"
          defaultValue={params.location}
          placeholder="Location"
          className="h-11 rounded-md border border-border px-3 text-sm"
        />
        <input
          name="min"
          type="number"
          defaultValue={params.min}
          placeholder="Min price (KSh)"
          className="h-11 rounded-md border border-border px-3 text-sm"
        />
        <input
          name="max"
          type="number"
          defaultValue={params.max}
          placeholder="Max price (KSh)"
          className="h-11 rounded-md border border-border px-3 text-sm"
        />
        <label className="col-span-full flex items-center gap-2 text-sm text-charcoal">
          <input type="checkbox" name="custom" value="true" defaultChecked={params.custom === "true"} />
          Custom-made available only
        </label>
        <div className="col-span-full flex justify-end">
          <Button type="submit">Apply filters</Button>
        </div>
      </form>

      {products.length === 0 ? (
        <div className="mt-16 text-center text-muted-foreground">
          <p className="text-lg font-medium text-charcoal">No products match those filters</p>
          <p className="mt-1">Try widening your search or clearing a filter.</p>
          <Link href="/products" className="mt-4 inline-block text-forest underline">
            Clear all filters
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Link key={p.id} href={`/products/${p.slug}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <div className="aspect-[4/3] w-full overflow-hidden rounded-t-lg bg-muted">
                  {p.primary_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.primary_image_url}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No photo yet
                    </div>
                  )}
                </div>
                <CardContent>
                  <p className="text-xs uppercase tracking-wide text-rust">{p.category?.name}</p>
                  <h3 className="mt-1 font-medium text-charcoal">{p.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.location}</p>
                  <p className="mt-2 font-medium text-forest">
                    {p.price_from
                      ? `KSh ${p.price_from.toLocaleString()}${p.price_to ? ` – ${p.price_to.toLocaleString()}` : "+"}`
                      : "Price on request"}
                  </p>
                  {p.is_customizable && (
                    <span className="mt-2 inline-block rounded-full bg-gold-soft px-2 py-0.5 text-xs text-charcoal">
                      Custom-made available
                    </span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <Link href={`/products?${nextPageParams.toString()}`}>
            <Button variant="outline">Load more</Button>
          </Link>
        </div>
      )}
    </main>
  );
}
