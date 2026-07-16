import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import {
  buildPaymentReference,
  buildWompiCheckoutUrl,
  errorMessage,
  generateIntegritySignature,
  jsonResponse,
  WOMPI_PREMIUM_PRODUCT_CODE,
  WOMPI_PROVIDER,
  WOMPI_SANDBOX_ENVIRONMENT,
} from "../_shared/wompi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getServiceRoleKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (secretKeys) {
    const parsed = JSON.parse(secretKeys);
    return parsed.default ?? Object.values(parsed)[0] ?? null;
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

function readRequiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = readRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getServiceRoleKey();
    const wompiPublicKey = readRequiredEnv("WOMPI_PUBLIC_KEY_SANDBOX");
    const wompiIntegritySecret = readRequiredEnv(
      "WOMPI_INTEGRITY_SECRET_SANDBOX",
    );
    const checkoutBaseUrl = Deno.env.get("WOMPI_CHECKOUT_BASE_URL_SANDBOX") ||
      "https://checkout.wompi.co/p/";
    const redirectUrl = Deno.env.get("WOMPI_REDIRECT_URL_SANDBOX") || undefined;

    if (!serviceRoleKey) throw new Error("Missing Supabase service role key.");

    const authHeader = request.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth
      .getUser();

    if (userError || !userData?.user?.id) {
      return jsonResponse({ ok: false, error: "Debes iniciar sesion." }, {
        status: 401,
        headers: corsHeaders,
      });
    }

    const body = await request.json().catch(() => ({}));
    const planId = String(body?.plan_id || WOMPI_PREMIUM_PRODUCT_CODE);

    if (planId !== WOMPI_PREMIUM_PRODUCT_CODE) {
      return jsonResponse({ ok: false, error: "Plan no disponible." }, {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: product, error: productError } = await admin
      .from("payment_products")
      .select(
        "id,code,name,amount_in_cents,currency,duration_days,provider,environment,active",
      )
      .eq("provider", WOMPI_PROVIDER)
      .eq("environment", WOMPI_SANDBOX_ENVIRONMENT)
      .eq("code", planId)
      .eq("active", true)
      .single();

    if (productError || !product) {
      throw productError || new Error("Producto Premium no configurado.");
    }

    const { data: order, error: orderError } = await admin
      .from("payment_orders")
      .insert({
        user_id: userData.user.id,
        product_id: product.id,
        provider: WOMPI_PROVIDER,
        environment: WOMPI_SANDBOX_ENVIRONMENT,
        reference: crypto.randomUUID(),
        amount_in_cents: product.amount_in_cents,
        currency: product.currency,
        status: "pending",
        metadata: { source: "wompi-create-checkout", plan_id: planId },
      })
      .select("id,reference")
      .single();

    if (orderError || !order) {
      throw orderError || new Error("No fue posible crear la orden.");
    }

    const reference = buildPaymentReference(userData.user.id, order.id);
    const signature = await generateIntegritySignature({
      reference,
      amountInCents: product.amount_in_cents,
      currency: product.currency,
      integritySecret: wompiIntegritySecret,
    });
    const checkoutUrl = buildWompiCheckoutUrl({
      checkoutBaseUrl,
      publicKey: wompiPublicKey,
      currency: product.currency,
      amountInCents: product.amount_in_cents,
      reference,
      redirectUrl,
      signature,
    });

    const { error: updateError } = await admin
      .from("payment_orders")
      .update({
        reference,
        checkout_url: checkoutUrl,
        metadata: { source: "wompi-create-checkout", plan_id: planId },
      })
      .eq("id", order.id);

    if (updateError) throw updateError;

    return jsonResponse({
      ok: true,
      order_id: order.id,
      reference,
      checkout_url: checkoutUrl,
      amount_in_cents: product.amount_in_cents,
      currency: product.currency,
      environment: WOMPI_SANDBOX_ENVIRONMENT,
    }, { headers: corsHeaders });
  } catch (error) {
    return jsonResponse({ ok: false, error: errorMessage(error) }, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
