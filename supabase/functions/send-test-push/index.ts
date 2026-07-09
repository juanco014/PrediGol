import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorization = request.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublicKey = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("WEB_PUSH_VAPID_SUBJECT") || "mailto:admin@predigol.app";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Faltan variables internas de Supabase.");
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("Faltan secretos VAPID de Web Push.");
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();

    if (userError || !userData.user) {
      return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: subscriptions, error: subscriptionsError } = await admin
      .from("web_push_subscriptions")
      .select("id, endpoint, p256dh, auth_key")
      .eq("user_id", userData.user.id)
      .eq("active", true);

    if (subscriptionsError) throw subscriptionsError;

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    const payload = JSON.stringify({
      title: "PrediGol listo",
      body: "Las notificaciones Web Push quedaron activadas en este dispositivo.",
      url: "/notificaciones",
      tag: "predigol-push-enabled",
    });
    let sent = 0;

    for (const subscription of subscriptions || []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth_key,
            },
          },
          payload
        );
        sent += 1;
      } catch (pushError) {
        const message = pushError instanceof Error ? pushError.message : String(pushError);
        await admin
          .from("web_push_subscriptions")
          .update({ active: false, last_error: message, updated_at: new Date().toISOString() })
          .eq("id", subscription.id);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
