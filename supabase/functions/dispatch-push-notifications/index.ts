import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Subscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
};

type Match = {
  id: string;
  torneo: string;
  fecha_orden: string;
  local_nombre: string;
  visitante_nombre: string;
  estado: string;
  goles_local_final: number | null;
  goles_visitante_final: number | null;
};

type Event = {
  key: string;
  type: string;
  partidoId: string;
  title: string;
  body: string;
  url: string;
};

type Preferences = {
  reminder_24h: boolean;
  reminder_1h: boolean;
  kickoff_updates: boolean;
  result_updates: boolean;
  favorite_updates: boolean;
};

const HOUR_MS = 60 * 60 * 1000;

function normalize(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function buildEvent(
  match: Match,
  now: number,
  predictionExists: boolean,
  preferences: Preferences,
  favorite: boolean
): Event | null {
  const teams = `${match.local_nombre} vs ${match.visitante_nombre}`;
  const kickoff = new Date(match.fecha_orden).getTime();
  const remaining = kickoff - now;

  if (
    match.estado === "en_vivo" &&
    (preferences.kickoff_updates || (preferences.favorite_updates && favorite))
  ) {
    return {
      key: `kickoff:${match.id}`,
      type: "kickoff",
      partidoId: match.id,
      title: favorite ? "Tu favorito esta en vivo" : "Partido en vivo",
      body: `${teams} ya esta en juego.`,
      url: `/partidos/${match.id}`,
    };
  }

  if (match.estado === "proximo" && !predictionExists && remaining > 0) {
    if (remaining <= HOUR_MS && preferences.reminder_1h) {
      return {
        key: `reminder-1h:${match.id}`,
        type: "reminder_1h",
        partidoId: match.id,
        title: "Ultima hora para pronosticar",
        body: `${teams} comienza en menos de una hora.`,
        url: `/partidos/${match.id}`,
      };
    }

    if (remaining <= 24 * HOUR_MS && preferences.reminder_24h) {
      return {
        key: `reminder-24h:${match.id}`,
        type: "reminder_24h",
        partidoId: match.id,
        title: "Te falta pronosticar",
        body: `${teams} se juega dentro de las proximas 24 horas.`,
        url: `/partidos/${match.id}`,
      };
    }
  }

  if (
    match.estado === "finalizado" &&
    predictionExists &&
    preferences.result_updates
  ) {
    return {
      key: `result:${match.id}`,
      type: "result",
      partidoId: match.id,
      title: "Resultado disponible",
      body: `${teams} termino ${match.goles_local_final ?? 0} - ${match.goles_visitante_final ?? 0}. Revisa tus puntos.`,
      url: `/partidos/${match.id}`,
    };
  }

  return null;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublicKey = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("WEB_PUSH_VAPID_SUBJECT") || "mailto:admin@predigol.app";

    if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
      throw new Error("Faltan variables internas para el dispatcher Push.");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: subscriptionsData, error: subscriptionsError } = await admin
      .from("web_push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth_key")
      .eq("active", true);

    if (subscriptionsError) throw subscriptionsError;
    const subscriptions = (subscriptionsData || []) as Subscription[];

    if (subscriptions.length === 0) {
      return new Response(JSON.stringify({ ok: true, subscriptions: 0, sent: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const userIds = [...new Set(subscriptions.map((item) => item.user_id))];
    const now = Date.now();
    const from = new Date(now - 48 * HOUR_MS).toISOString();
    const to = new Date(now + 24 * HOUR_MS).toISOString();

    const [matchesResponse, preferencesResponse, predictionsResponse, teamsResponse, competitionsResponse] =
      await Promise.all([
        admin
          .from("partidos")
          .select("id, torneo, fecha_orden, local_nombre, visitante_nombre, estado, goles_local_final, goles_visitante_final")
          .eq("es_relevante", true)
          .gte("fecha_orden", from)
          .lte("fecha_orden", to),
        admin
          .from("user_notification_preferences")
          .select("user_id, reminder_24h, reminder_1h, kickoff_updates, result_updates, favorite_updates")
          .in("user_id", userIds),
        admin
          .from("pronosticos")
          .select("usuario_id, partido_id")
          .in("usuario_id", userIds),
        admin
          .from("user_favorite_teams")
          .select("user_id, team_key")
          .in("user_id", userIds),
        admin
          .from("user_favorite_competitions")
          .select("user_id, competition_key")
          .in("user_id", userIds),
      ]);

    for (const response of [matchesResponse, preferencesResponse, predictionsResponse, teamsResponse, competitionsResponse]) {
      if (response.error) throw response.error;
    }

    const matches = (matchesResponse.data || []) as Match[];
    const preferencesByUser = new Map(
      (preferencesResponse.data || []).map((item) => [item.user_id, item])
    );
    const predictions = new Set(
      (predictionsResponse.data || []).map((item) => `${item.usuario_id}:${item.partido_id}`)
    );
    const favoriteTeams = new Set(
      (teamsResponse.data || []).map((item) => `${item.user_id}:${item.team_key}`)
    );
    const favoriteCompetitions = new Set(
      (competitionsResponse.data || []).map((item) => `${item.user_id}:${item.competition_key}`)
    );
    const subscriptionIds = subscriptions.map((item) => item.id);
    const { data: deliveredData, error: deliveredError } = await admin
      .from("web_push_deliveries")
      .select("subscription_id, event_key")
      .in("subscription_id", subscriptionIds)
      .gte("sent_at", new Date(now - 30 * 24 * HOUR_MS).toISOString());

    if (deliveredError) throw deliveredError;
    const delivered = new Set(
      (deliveredData || []).map((item) => `${item.subscription_id}:${item.event_key}`)
    );

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    let sent = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
      const preferences = preferencesByUser.get(subscription.user_id) || {
        reminder_24h: true,
        reminder_1h: true,
        kickoff_updates: true,
        result_updates: true,
        favorite_updates: true,
      };

      for (const match of matches) {
        const predictionExists = predictions.has(`${subscription.user_id}:${match.id}`);
        const favorite =
          favoriteTeams.has(`${subscription.user_id}:${normalize(match.local_nombre)}`) ||
          favoriteTeams.has(`${subscription.user_id}:${normalize(match.visitante_nombre)}`) ||
          favoriteCompetitions.has(`${subscription.user_id}:${normalize(match.torneo)}`);
        const event = buildEvent(match, now, predictionExists, preferences, favorite);

        if (!event || delivered.has(`${subscription.id}:${event.key}`)) continue;

        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
            },
            JSON.stringify({
              title: event.title,
              body: event.body,
              url: event.url,
              tag: event.key,
            })
          );
          await admin.from("web_push_deliveries").insert({
            subscription_id: subscription.id,
            user_id: subscription.user_id,
            event_key: event.key,
            partido_id: event.partidoId,
            event_type: event.type,
          });
          delivered.add(`${subscription.id}:${event.key}`);
          sent += 1;
        } catch (pushError) {
          const message = pushError instanceof Error ? pushError.message : String(pushError);
          await admin
            .from("web_push_subscriptions")
            .update({ active: false, last_error: message, updated_at: new Date().toISOString() })
            .eq("id", subscription.id);
          failed += 1;
          break;
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, subscriptions: subscriptions.length, matches: matches.length, sent, failed }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
