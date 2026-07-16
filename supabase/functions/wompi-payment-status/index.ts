import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import { errorMessage, jsonResponse } from "../_shared/wompi.ts";

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

  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = readRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getServiceRoleKey();
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

    const url = new URL(request.url);
    const orderId = url.searchParams.get("order_id");
    const reference = url.searchParams.get("reference");

    if (!orderId && !reference) {
      return jsonResponse({
        ok: false,
        error: "order_id o reference es requerido.",
      }, { status: 400, headers: corsHeaders });
    }

    let query = admin
      .from("payment_orders")
      .select(
        "id,reference,status,amount_in_cents,currency,environment,checkout_url,provider_payment_id,approved_at,created_at,updated_at",
      )
      .eq("user_id", userData.user.id)
      .limit(1);

    query = orderId
      ? query.eq("id", orderId)
      : query.eq("reference", reference);

    const { data: order, error: orderError } = await query.single();

    if (orderError || !order) {
      return jsonResponse({ ok: false, error: "Orden no encontrada." }, {
        status: 404,
        headers: corsHeaders,
      });
    }

    return jsonResponse({ ok: true, order }, { headers: corsHeaders });
  } catch (error) {
    return jsonResponse({ ok: false, error: errorMessage(error) }, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
