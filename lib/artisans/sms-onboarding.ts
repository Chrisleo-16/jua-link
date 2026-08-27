import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/africastalking/sms";

type OnboardingStep =
  | "awaiting_full_name"
  | "awaiting_business_name"
  | "awaiting_location"
  | "awaiting_craft_category"
  | "awaiting_products_made"
  | "awaiting_years_experience"
  | "awaiting_description"
  | "awaiting_confirmation"
  | "completed"
  | "cancelled";

interface OnboardingSessionRow {
  id: string;
  phone_number: string;
  current_step: OnboardingStep;
  application_data: Record<string, unknown> | null;
  completed: boolean;
  cancelled: boolean;
}

interface HandleOnboardingParams {
  from: string;
  text: string;
  messageId: string | null;
  payload: Record<string, FormDataEntryValue>;
}

export interface HandleOnboardingResult {
  handled: boolean;
  status?: string;
  reason?: string;
}

const START_WORDS = new Set(["JOIN", "APPLY", "ARTISAN"]);
const YES_WORDS = new Set(["Y", "YES"]);
const NO_WORDS = new Set(["N", "NO"]);

function normalize(text: string) {
  return text.trim().toUpperCase();
}

function asData(value: Record<string, unknown> | null): Record<string, string> {
  const source = value ?? {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(source)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

async function logInbound(params: {
  from: string;
  text: string;
  messageId: string | null;
  payload: Record<string, FormDataEntryValue>;
  processingResult: string;
  artisanId?: string | null;
}) {
  const supabase = createServiceRoleClient();
  await supabase.from("sms_messages").insert({
    artisan_id: params.artisanId ?? null,
    customer_phone: params.from,
    direction: "inbound",
    message_body: params.text,
    africa_talking_message_id: params.messageId,
    delivery_status: "received",
    processing_result: params.processingResult,
    provider_payload: params.payload,
  });
}

async function sendOnboardingPrompt(to: string, message: string) {
  await sendSms({ to, message });
}

export async function handleArtisanOnboardingSms(
  params: HandleOnboardingParams
): Promise<HandleOnboardingResult> {
  const { from, text, messageId, payload } = params;
  const supabase = createServiceRoleClient();
  const normalized = normalize(text);

  const { data: existingArtisan } = await supabase
    .from("artisans")
    .select("id, business_name, verification_status, is_active")
    .eq("phone_number", from)
    .maybeSingle();

  const { data: session } = await supabase
    .from("sms_artisan_onboarding_sessions")
    .select("id, phone_number, current_step, application_data, completed, cancelled")
    .eq("phone_number", from)
    .eq("completed", false)
    .eq("cancelled", false)
    .maybeSingle<OnboardingSessionRow>();

  if (!session) {
    if (!START_WORDS.has(normalized)) {
      return { handled: false };
    }

    await logInbound({
      from,
      text,
      messageId,
      payload,
      artisanId: existingArtisan?.id ?? null,
      processingResult: "onboarding_start",
    });

    if (existingArtisan) {
      await sendOnboardingPrompt(
        from,
        `JuaLink: This number is already registered as ${existingArtisan.business_name}. Status: ${existingArtisan.verification_status}.`
      );
      return { handled: true, status: "ignored", reason: "artisan_already_registered" };
    }

    await supabase.from("sms_artisan_onboarding_sessions").upsert(
      {
        phone_number: from,
        current_step: "awaiting_full_name",
        application_data: {},
        completed: false,
        cancelled: false,
      },
      { onConflict: "phone_number" }
    );

    await sendOnboardingPrompt(
      from,
      "JuaLink artisan signup started. Reply with your full name. Reply CANCEL anytime to stop."
    );
    return { handled: true, status: "onboarding_started" };
  }

  await logInbound({
    from,
    text,
    messageId,
    payload,
    artisanId: existingArtisan?.id ?? null,
    processingResult: "onboarding_step",
  });

  if (normalized === "CANCEL") {
    await supabase
      .from("sms_artisan_onboarding_sessions")
      .update({ current_step: "cancelled", completed: true, cancelled: true })
      .eq("id", session.id);

    await sendOnboardingPrompt(from, "JuaLink: artisan signup cancelled. Reply JOIN when ready to start again.");
    return { handled: true, status: "cancelled" };
  }

  const data = asData(session.application_data);
  const raw = text.trim();

  if (session.current_step === "awaiting_full_name") {
    if (raw.length < 2) {
      await sendOnboardingPrompt(from, "Please enter your full name (at least 2 characters).");
      return { handled: true, status: "invalid", reason: "full_name" };
    }

    data.fullName = raw;
    await supabase
      .from("sms_artisan_onboarding_sessions")
      .update({ current_step: "awaiting_business_name", application_data: data })
      .eq("id", session.id);

    await sendOnboardingPrompt(from, "Great. Reply with your business/workshop name.");
    return { handled: true, status: "onboarding_progress" };
  }

  if (session.current_step === "awaiting_business_name") {
    if (raw.length < 2) {
      await sendOnboardingPrompt(from, "Please enter your business/workshop name (at least 2 characters).");
      return { handled: true, status: "invalid", reason: "business_name" };
    }

    data.businessName = raw;
    await supabase
      .from("sms_artisan_onboarding_sessions")
      .update({ current_step: "awaiting_location", application_data: data })
      .eq("id", session.id);

    await sendOnboardingPrompt(from, "Reply with your location (e.g. Kasarani, Nairobi).");
    return { handled: true, status: "onboarding_progress" };
  }

  if (session.current_step === "awaiting_location") {
    if (raw.length < 2) {
      await sendOnboardingPrompt(from, "Please enter your location.");
      return { handled: true, status: "invalid", reason: "location" };
    }

    data.location = raw;
    await supabase
      .from("sms_artisan_onboarding_sessions")
      .update({ current_step: "awaiting_craft_category", application_data: data })
      .eq("id", session.id);

    await sendOnboardingPrompt(from, "Reply with your craft category (e.g. Metalwork, Carpentry)." );
    return { handled: true, status: "onboarding_progress" };
  }

  if (session.current_step === "awaiting_craft_category") {
    if (raw.length < 2) {
      await sendOnboardingPrompt(from, "Please enter your craft category.");
      return { handled: true, status: "invalid", reason: "craft_category" };
    }

    data.craftCategory = raw;
    await supabase
      .from("sms_artisan_onboarding_sessions")
      .update({ current_step: "awaiting_products_made", application_data: data })
      .eq("id", session.id);

    await sendOnboardingPrompt(from, "Reply with products you make (e.g. Gates, grills, shelves).");
    return { handled: true, status: "onboarding_progress" };
  }

  if (session.current_step === "awaiting_products_made") {
    if (raw.length < 2) {
      await sendOnboardingPrompt(from, "Please describe products you make.");
      return { handled: true, status: "invalid", reason: "products_made" };
    }

    data.productsMade = raw;
    await supabase
      .from("sms_artisan_onboarding_sessions")
      .update({ current_step: "awaiting_years_experience", application_data: data })
      .eq("id", session.id);

    await sendOnboardingPrompt(from, "Reply with years of experience (0-80), or SKIP.");
    return { handled: true, status: "onboarding_progress" };
  }

  if (session.current_step === "awaiting_years_experience") {
    if (normalized !== "SKIP") {
      const years = Number(raw);
      if (!Number.isInteger(years) || years < 0 || years > 80) {
        await sendOnboardingPrompt(from, "Please enter a valid whole number from 0 to 80, or reply SKIP.");
        return { handled: true, status: "invalid", reason: "years_experience" };
      }
      data.yearsExperience = String(years);
    }

    await supabase
      .from("sms_artisan_onboarding_sessions")
      .update({ current_step: "awaiting_description", application_data: data })
      .eq("id", session.id);

    await sendOnboardingPrompt(
      from,
      "Reply with a short description of your work (at least 10 characters)."
    );
    return { handled: true, status: "onboarding_progress" };
  }

  if (session.current_step === "awaiting_description") {
    if (raw.length < 10) {
      await sendOnboardingPrompt(from, "Description too short. Please provide at least 10 characters.");
      return { handled: true, status: "invalid", reason: "description" };
    }

    data.description = raw;
    await supabase
      .from("sms_artisan_onboarding_sessions")
      .update({ current_step: "awaiting_confirmation", application_data: data })
      .eq("id", session.id);

    await sendOnboardingPrompt(
      from,
      "Confirm submission: Reply YES to submit your artisan application, or NO to cancel."
    );
    return { handled: true, status: "onboarding_progress" };
  }

  if (session.current_step === "awaiting_confirmation") {
    if (NO_WORDS.has(normalized)) {
      await supabase
        .from("sms_artisan_onboarding_sessions")
        .update({ current_step: "cancelled", completed: true, cancelled: true })
        .eq("id", session.id);

      await sendOnboardingPrompt(from, "JuaLink: artisan signup cancelled. Reply JOIN anytime to start again.");
      return { handled: true, status: "cancelled" };
    }

    if (!YES_WORDS.has(normalized)) {
      await sendOnboardingPrompt(from, "Please reply YES to submit, or NO to cancel.");
      return { handled: true, status: "invalid", reason: "confirmation" };
    }

    const { data: alreadyExists } = await supabase
      .from("artisans")
      .select("id")
      .eq("phone_number", from)
      .maybeSingle();

    if (alreadyExists) {
      await supabase
        .from("sms_artisan_onboarding_sessions")
        .update({ current_step: "completed", completed: true, cancelled: false })
        .eq("id", session.id);

      await sendOnboardingPrompt(from, "JuaLink: this phone number is already registered as an artisan.");
      return { handled: true, status: "ignored", reason: "artisan_already_registered" };
    }

    const yearsValue = data.yearsExperience ? Number(data.yearsExperience) : null;

    const { error: insertError } = await supabase.from("artisans").insert({
      full_name: data.fullName,
      business_name: data.businessName,
      phone_number: from,
      location: data.location,
      craft_category: data.craftCategory,
      products_made: data.productsMade,
      years_experience: Number.isInteger(yearsValue) ? yearsValue : null,
      description: data.description,
      verification_status: "PENDING",
      is_active: false,
    });

    if (insertError) {
      console.error("Failed to insert SMS artisan application:", insertError);
      await sendOnboardingPrompt(
        from,
        "JuaLink: we could not submit your application right now. Please reply YES again later."
      );
      return { handled: true, status: "error", reason: "insert_failed" };
    }

    await supabase
      .from("sms_artisan_onboarding_sessions")
      .update({ current_step: "completed", completed: true, cancelled: false, application_data: data })
      .eq("id", session.id);

    await sendOnboardingPrompt(
      from,
      "JuaLink: application submitted. Status is PENDING verification. Our team will contact you soon."
    );
    return { handled: true, status: "onboarding_submitted" };
  }

  return { handled: false };
}
