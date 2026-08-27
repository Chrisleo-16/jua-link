"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { submitArtisanApplication } from "@/lib/artisans/submit-application";

export default function JoinAsArtisanPage() {
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setStatus("submitting");
    setError(null);

    const result = await submitArtisanApplication({
      fullName: formData.get("fullName"),
      businessName: formData.get("businessName"),
      phoneNumber: formData.get("phoneNumber"),
      location: formData.get("location"),
      craftCategory: formData.get("craftCategory"),
      productsMade: formData.get("productsMade"),
      yearsExperience: formData.get("yearsExperience") || undefined,
      description: formData.get("description"),
      declarationAccepted: formData.get("declarationAccepted") === "on" ? true : undefined,
    });

    if (result.success) {
      setStatus("success");
    } else {
      setStatus("error");
      setError(result.error);
    }
  }

  if (status === "success") {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold text-forest">Application received</h1>
        <p className="mt-3 text-charcoal">
          Status: <span className="font-medium">Pending verification</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          A JuaLink coordinator will review your workshop details and reach out on the phone
          number you provided.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-charcoal">Join as an artisan</h1>
      <p className="mt-1 text-muted-foreground">
        No app, no dashboard required. Once verified, buyer requests come to you by SMS.
      </p>

      <form action={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" required />
        </div>
        <div>
          <Label htmlFor="businessName">Business / workshop name</Label>
          <Input id="businessName" name="businessName" required />
        </div>
        <div>
          <Label htmlFor="phoneNumber">Phone number</Label>
          <Input id="phoneNumber" name="phoneNumber" placeholder="+2547XXXXXXXX" required />
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" placeholder="e.g. Kamukunji, Nairobi" required />
        </div>
        <div>
          <Label htmlFor="craftCategory">Craft category</Label>
          <Input id="craftCategory" name="craftCategory" placeholder="e.g. Metalwork" required />
        </div>
        <div>
          <Label htmlFor="productsMade">Products you make</Label>
          <Input id="productsMade" name="productsMade" placeholder="Gates, grills, lockers…" required />
        </div>
        <div>
          <Label htmlFor="yearsExperience">Years of experience (optional)</Label>
          <Input id="yearsExperience" name="yearsExperience" type="number" min={0} max={80} />
        </div>
        <div>
          <Label htmlFor="description">Tell us about your work</Label>
          <Textarea id="description" name="description" maxLength={1000} required />
        </div>

        <label className="flex items-start gap-2 text-sm text-charcoal">
          <input type="checkbox" name="declarationAccepted" className="mt-1" required />
          I confirm this information is accurate and agree to be contacted by JuaLink for
          verification.
        </label>

        {status === "error" && error && (
          <p className="text-sm text-rust" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={status === "submitting"}>
          {status === "submitting" ? "Submitting…" : "Submit application"}
        </Button>
      </form>
    </main>
  );
}
