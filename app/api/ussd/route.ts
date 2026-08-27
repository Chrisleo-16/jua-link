import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { createOrderRequest } from "@/lib/orders/create-order";
import { sendSms } from "@/lib/africastalking/sms";
import { artisanWelcomeSms } from "@/lib/africastalking/templates";
import {
  getCategoriesForMenu,
  getProductsForCategory,
  renderCategoryMenu,
  renderProductMenu,
  pickFromMenu,
} from "@/lib/ussd/menu";

const SUPPORT_CONTACT = "+254 700 000 000";

/**
 * Africa's Talking USSD webhook. Every response must be plain text starting
 * with "CON " (session continues, another screen follows) or "END " (session
 * closes). See lib/ussd/menu.ts for why we parse `text` instead of tracking
 * state server-side.
 * https://developers.africastalking.com/docs/ussd/overview
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const sessionId = form.get("sessionId")?.toString() ?? "";
  const phoneNumber = form.get("phoneNumber")?.toString() ?? "";
  const serviceCode = form.get("serviceCode")?.toString() ?? "";
  const text = form.get("text")?.toString() ?? "";

  const steps = text.length > 0 ? text.split("*") : [];
  const response = await handleUssdRequest(steps, phoneNumber);

  // Fire-and-forget session audit log (see migration 0002 comment — this is
  // for the admin USSD log, not used to derive navigation state).
  logUssdSession({
    sessionId,
    phoneNumber,
    serviceCode,
    text,
    currentStep: steps[0] ?? "root",
    completed: response.startsWith("END"),
  }).catch((err) => console.error("USSD session log failed:", err));

  return new NextResponse(response, {
    headers: { "Content-Type": "text/plain" },
  });
}

async function handleUssdRequest(steps: string[], phoneNumber: string): Promise<string> {
  const existingArtisan = await findArtisanByPhone(phoneNumber);

  // Root menu
  if (steps.length === 0) {
    if (existingArtisan) {
      return (
        "CON Welcome to JuaLink\n" +
        "1. Browse products\n" +
        "2. Request a product\n" +
        "3. Track my request\n" +
        "4. Help"
      );
    }

    return (
      "CON Welcome to JuaLink\n" +
      "1. Browse products\n" +
      "2. Request a product\n" +
      "3. Track my request\n" +
      "4. Help\n" +
      "5. Join as artisan"
    );
  }

  const mainChoice = steps[0];

  switch (mainChoice) {
    case "1":
      return handleBrowse(steps);
    case "2":
      return handleRequest(steps, phoneNumber);
    case "3":
      return handleTrack(steps, phoneNumber);
    case "4":
      return `END JuaLink support: call or SMS ${SUPPORT_CONTACT}.`;
    case "5":
      if (existingArtisan) {
        return "END You are already registered as an artisan.";
      }
      return handleArtisanRegistration(steps, phoneNumber);
    default:
      return "END Invalid choice. Please dial in again.";
  }
}

// ---------------------------------------------------------------------------
// 1. Browse products — read-only, ends after showing a short list.
// ---------------------------------------------------------------------------
async function handleBrowse(steps: string[]): Promise<string> {
  const categories = await getCategoriesForMenu();

  if (steps.length === 1) {
    return renderCategoryMenu(categories, "Browse products\nChoose a category:");
  }

  const category = pickFromMenu(categories, steps[1]);
  if (!category) return "END Invalid category. Please dial in again.";

  const products = await getProductsForCategory(category.id, 5);
  if (products.length === 0) {
    return `END No products currently listed under ${category.name}. Please check back later.`;
  }
  const lines = products.map(
    (p) => `- ${p.name}${p.price_from ? ` (KSh ${Number(p.price_from).toLocaleString()}+)` : ""}`
  );
  return (
    `END ${category.name}:\n` +
    lines.join("\n") +
    `\nDial in again and choose "2. Request a product" to request one.`
  );
}

// ---------------------------------------------------------------------------
// 2. Request a product — category -> product -> quantity -> location -> create.
// ---------------------------------------------------------------------------
async function handleRequest(steps: string[], phoneNumber: string): Promise<string> {
  const categories = await getCategoriesForMenu();

  // Step 1: choose category
  if (steps.length === 1) {
    return renderCategoryMenu(categories, "Request a product\nChoose a category:");
  }

  const category = pickFromMenu(categories, steps[1]);
  if (!category) return "END Invalid category. Please dial in again.";

  const products = await getProductsForCategory(category.id, 5);

  // Step 2: choose product
  if (steps.length === 2) {
    return renderProductMenu(products, `${category.name}\nChoose a product:`);
  }

  const product = pickFromMenu(products, steps[2]);
  if (!product) return "END Invalid product. Please dial in again.";

  // Step 3: quantity
  if (steps.length === 3) {
    return `CON How many "${product.name}" do you need?\nEnter a number:`;
  }

  const quantity = Number(steps[3]);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    return "END Invalid quantity. Please dial in again and enter a number.";
  }

  // Step 4: location
  if (steps.length === 4) {
    return "CON Enter your location (e.g. Kasarani):";
  }

  const location = steps[4]?.trim();
  if (!location) {
    return "END Location cannot be empty. Please dial in again.";
  }

  // Step 5: everything collected — create the order.
  // USSD doesn't collect a name, so we use a clear placeholder the admin
  // dashboard can recognize; the phone number is the real identity here.
  const result = await createOrderRequest({
    productId: product.id,
    customerName: "USSD customer",
    customerPhone: phoneNumber,
    customerLocation: location,
    quantity,
    requestType: "standard",
    consentToContact: true, // implicit: initiating a USSD request request is the consent action
  });

  if (!result.success) {
    return `END ${result.error}`;
  }

  return (
    `END Request submitted. Reference: ${result.orderReference}.\n` +
    `We've notified the artisan. You'll get an SMS once they respond.`
  );
}

// ---------------------------------------------------------------------------
// 3. Track request — reference in, status out.
// ---------------------------------------------------------------------------
async function handleTrack(steps: string[], phoneNumber: string): Promise<string> {
  if (steps.length === 1) {
    return "CON Enter your order reference (e.g. JL-2048):";
  }

  const reference = steps[1]?.trim().toUpperCase();
  const supabase = createServiceRoleClient();
  const { data } = await supabase.rpc("track_order", {
    p_reference: reference,
    p_phone: phoneNumber,
  });

  const order = data?.[0];
  if (!order) {
    return "END No order found with that reference for this phone number.";
  }

  return `END ${order.order_reference}: ${order.status.replace(/_/g, " ")}`;
}

// ---------------------------------------------------------------------------
// 5. Join as artisan — name -> location -> shop -> application create.
// ---------------------------------------------------------------------------
async function handleArtisanRegistration(steps: string[], phoneNumber: string): Promise<string> {
  if (!phoneNumber) {
    return "END We could not read your phone number. Please try again later.";
  }

  // Step 1: ask full name
  if (steps.length === 1) {
    return "CON Join as artisan\nEnter your full name:";
  }

  const fullName = steps[1]?.trim();
  if (!fullName || fullName.length < 2) {
    return "END Invalid name. Please dial in again.";
  }

  // Step 2: ask location
  if (steps.length === 2) {
    return "CON Enter your location:";
  }

  const location = steps[2]?.trim();
  if (!location || location.length < 2) {
    return "END Invalid location. Please dial in again.";
  }

  // Step 3: ask shop name
  if (steps.length === 3) {
    return "CON Enter your shop name:";
  }

  const shopName = steps[3]?.trim();
  if (!shopName || shopName.length < 2) {
    return "END Invalid shop name. Please dial in again.";
  }

  const supabase = createServiceRoleClient();

  // Prevent duplicate submissions for the same phone number.
  const { data: existingArtisan } = await supabase
    .from("artisans")
    .select("id")
    .eq("phone_number", phoneNumber)
    .limit(1)
    .maybeSingle();

  if (existingArtisan) {
    return "END You are already registered as an artisan.";
  }

  const { error } = await supabase.from("artisans").insert({
    full_name: fullName,
    business_name: shopName,
    phone_number: phoneNumber,
    location,
    craft_category: "General",
    products_made: "Not provided via USSD",
    description: `USSD artisan application from ${shopName}.`,
    verification_status: "VERIFIED",
    is_active: true,
  });

  if (error) {
    console.error("USSD artisan registration failed:", error);
    return "END We could not submit your registration now. Please try again later.";
  }

  await sendSms({
    to: phoneNumber,
    message: artisanWelcomeSms(fullName),
  });

  return "END Registration successful. You are now registered as an artisan.";
}

async function findArtisanByPhone(phoneNumber: string): Promise<{ id: string } | null> {
  if (!phoneNumber) return null;

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("artisans")
    .select("id")
    .eq("phone_number", phoneNumber)
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

// ---------------------------------------------------------------------------
// Session audit log (best-effort, never blocks the response)
// ---------------------------------------------------------------------------
async function logUssdSession(params: {
  sessionId: string;
  phoneNumber: string;
  serviceCode: string;
  text: string;
  currentStep: string;
  completed: boolean;
}) {
  const supabase = createServiceRoleClient();
  await supabase.from("ussd_sessions").upsert(
    {
      session_id: params.sessionId,
      phone_number: params.phoneNumber,
      service_code: params.serviceCode,
      text_input: params.text,
      current_step: params.currentStep,
      completed: params.completed,
    },
    { onConflict: "session_id" }
  );
}
