import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import {
  assertApprovedTransactionMatchesOrder,
  errorMessage,
  getWompiTransaction,
  jsonResponse,
  mapWompiStatus,
  sha256Hex,
  verifyWompiEventSignature,
  WOMPI_PROVIDER,
  WOMPI_SANDBOX_ENVIRONMENT,
} from "../_shared/wompi.ts";

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
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, {
      status: 405,
    });
  }

  const rawBody = await request.text();
  let webhookEventId: string | null = null;

  try {
    const supabaseUrl = readRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getServiceRoleKey();
    const wompiEventsSecret = readRequiredEnv("WOMPI_EVENTS_SECRET_SANDBOX");

    if (!serviceRoleKey) throw new Error("Missing Supabase service role key.");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const payload = JSON.parse(rawBody);
    const transaction = getWompiTransaction(payload);
    const eventHash = await sha256Hex(rawBody);
    const signatureValid = await verifyWompiEventSignature(
      payload,
      wompiEventsSecret,
    );
    const internalStatus = mapWompiStatus(transaction.status);
    const providerEventId = String(
      payload?.id ||
        `${transaction.id || "unknown"}:${transaction.status || "unknown"}:${
          payload?.timestamp || "unknown"
        }`,
    );

    if (!transaction.id) throw new Error("Missing Wompi transaction id.");

    const { data: insertedEvent, error: eventError } = await admin
      .from("payment_webhook_events")
      .insert({
        provider: WOMPI_PROVIDER,
        environment: WOMPI_SANDBOX_ENVIRONMENT,
        provider_event_id: providerEventId,
        event_hash: eventHash,
        event_type: payload?.event || null,
        signature_valid: signatureValid,
        processed_status: "received",
        raw_payload: payload,
      })
      .select("id")
      .single();

    if (eventError) {
      if (String(eventError.code) === "23505") {
        return jsonResponse({ ok: true, duplicate: true });
      }

      throw eventError;
    }

    webhookEventId = insertedEvent.id;

    if (!signatureValid) {
      await admin.from("payment_webhook_events").update({
        processed_status: "failed",
        error_detail: "Invalid Wompi signature",
        processed_at: new Date().toISOString(),
      }).eq("id", webhookEventId);
      return jsonResponse({ ok: false, error: "Invalid Wompi signature" }, {
        status: 400,
      });
    }

    if (!transaction.reference) {
      throw new Error("Missing Wompi transaction reference.");
    }

    const { data: order, error: orderError } = await admin
      .from("payment_orders")
      .select(
        "id,user_id,reference,amount_in_cents,currency,environment,status",
      )
      .eq("provider", WOMPI_PROVIDER)
      .eq("environment", WOMPI_SANDBOX_ENVIRONMENT)
      .eq("reference", transaction.reference)
      .single();

    if (orderError || !order) {
      throw orderError || new Error("Payment order not found.");
    }

    assertApprovedTransactionMatchesOrder(transaction, order);

    const { data: tx, error: txError } = await admin
      .from("payment_transactions")
      .upsert({
        order_id: order.id,
        provider: WOMPI_PROVIDER,
        environment: WOMPI_SANDBOX_ENVIRONMENT,
        provider_payment_id: transaction.id,
        status: internalStatus,
        amount_in_cents: transaction.amount_in_cents,
        currency: transaction.currency,
        raw_payload: payload,
        processed_at: new Date().toISOString(),
      }, { onConflict: "provider,environment,provider_payment_id" })
      .select("id")
      .single();

    if (txError || !tx) {
      throw txError || new Error("No fue posible registrar la transaccion.");
    }

    await admin
      .from("payment_orders")
      .update({
        status: internalStatus,
        provider_payment_id: transaction.id,
        approved_at: internalStatus === "approved"
          ? new Date().toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    let activation = null;
    if (internalStatus === "approved") {
      const { data: activationData, error: activationError } = await admin.rpc(
        "predigol_apply_paid_premium_order",
        { p_order_id: order.id },
      );
      if (activationError) throw activationError;
      activation = activationData;
    }

    await admin
      .from("payment_webhook_events")
      .update({
        order_id: order.id,
        transaction_id: tx.id,
        processed_status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", webhookEventId);

    return jsonResponse({ ok: true, status: internalStatus, activation });
  } catch (error) {
    if (webhookEventId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = getServiceRoleKey();
        if (supabaseUrl && serviceRoleKey) {
          const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false },
          });
          await admin.from("payment_webhook_events").update({
            processed_status: "failed",
            error_detail: errorMessage(error),
            processed_at: new Date().toISOString(),
          }).eq("id", webhookEventId);
        }
      } catch {
        // Keep original webhook error response.
      }
    }

    return jsonResponse({ ok: false, error: errorMessage(error) }, {
      status: 500,
    });
  }
});
