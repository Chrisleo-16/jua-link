import { notFound } from "next/navigation";
import { fetchProductBySlug } from "@/lib/products/queries";
import { OrderRequestForm } from "@/components/order-request-form";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) notFound();

  const images = (product.product_images ?? []).sort(
    (a: any, b: any) => a.sort_order - b.sort_order
  );
  const artisan = product.artisan;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
            {images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={images[0].image_url}
                alt={images[0].alt_text ?? product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No photos yet
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {images.slice(1, 5).map((img: any) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={img.image_url}
                  src={img.image_url}
                  alt={img.alt_text ?? product.name}
                  className="aspect-square rounded-md object-cover"
                />
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <p className="text-xs uppercase tracking-wide text-rust">{product.category?.name}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-charcoal">
            {product.name}
          </h1>

          <p className="mt-3 text-xl font-medium text-forest">
            {product.price_from
              ? `KSh ${Number(product.price_from).toLocaleString()}${
                  product.price_to ? ` – ${Number(product.price_to).toLocaleString()}` : "+"
                }`
              : "Price on request"}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {product.material && (
              <>
                <dt className="text-muted-foreground">Material</dt>
                <dd className="text-charcoal">{product.material}</dd>
              </>
            )}
            {product.lead_time_days && (
              <>
                <dt className="text-muted-foreground">Lead time</dt>
                <dd className="text-charcoal">~{product.lead_time_days} days</dd>
              </>
            )}
            <dt className="text-muted-foreground">Location</dt>
            <dd className="text-charcoal">{product.location}</dd>
            <dt className="text-muted-foreground">Custom-made</dt>
            <dd className="text-charcoal">{product.is_customizable ? "Available" : "Not offered"}</dd>
          </dl>

          <p className="mt-5 text-sm leading-relaxed text-charcoal">{product.description}</p>

          {artisan && (
            <div className="mt-6 rounded-lg border border-border bg-muted/50 p-4">
              <p className="text-sm font-medium text-charcoal">{artisan.business_name}</p>
              <p className="text-sm text-muted-foreground">
                {artisan.craft_category} · {artisan.location}
                {artisan.years_experience ? ` · ${artisan.years_experience} yrs experience` : ""}
              </p>
              {artisan.verification_status === "VERIFIED" && (
                <span className="mt-2 inline-block rounded-full bg-forest-soft px-2 py-0.5 text-xs text-forest">
                  Verified artisan
                </span>
              )}
            </div>
          )}

          <div className="mt-4 rounded-md bg-gold-soft px-4 py-3 text-sm text-charcoal">
            This is a request. Final price, measurements, delivery, and payment are agreed after
            artisan confirmation.
          </div>

          <div className="mt-6">
            <OrderRequestForm productId={product.id} />
          </div>
        </div>
      </div>
    </main>
  );
}
