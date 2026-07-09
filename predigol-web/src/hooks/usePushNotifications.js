import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

function arrayBufferToBase64(buffer) {
  return window.btoa(
    String.fromCharCode(...new Uint8Array(buffer))
  );
}

export function usePushNotifications(usuarioId) {
  const publicKey = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY || "";
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  const [permission, setPermission] = useState(
    supported ? Notification.permission : "unsupported"
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(supported && Boolean(publicKey));
  const [error, setError] = useState("");

  const getRegistration = useCallback(async () => {
    const current = await navigator.serviceWorker.getRegistration();
    return current || navigator.serviceWorker.register("/sw.js");
  }, []);

  useEffect(() => {
    let active = true;

    if (!supported || !publicKey || !usuarioId) {
      return () => {
        active = false;
      };
    }

    Promise.resolve()
      .then(getRegistration)
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (active) {
          setSubscribed(Boolean(subscription));
          setPermission(Notification.permission);
          setLoading(false);
        }
      })
      .catch((syncError) => {
        console.error("Error al revisar Web Push:", syncError);
        if (active) {
          setError(syncError.message || "No fue posible revisar Web Push.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [getRegistration, publicKey, supported, usuarioId]);

  const enable = useCallback(async () => {
    if (!supported || !publicKey || !usuarioId) {
      throw new Error("Web Push no esta configurado en este dispositivo.");
    }

    setLoading(true);
    setError("");

    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== "granted") {
        throw new Error("Debes permitir notificaciones en el navegador.");
      }

      const registration = await getRegistration();
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      const p256dh = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");

      if (!p256dh || !auth) {
        throw new Error("El navegador no entrego las claves de suscripcion.");
      }

      const { error: saveError } = await supabase
        .from("web_push_subscriptions")
        .upsert(
          {
            user_id: usuarioId,
            endpoint: subscription.endpoint,
            p256dh: arrayBufferToBase64(p256dh),
            auth_key: arrayBufferToBase64(auth),
            user_agent: navigator.userAgent,
            active: true,
            last_error: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "endpoint" }
        );

      if (saveError) throw saveError;

      setSubscribed(true);

      const { error: testError } = await supabase.functions.invoke(
        "send-test-push",
        { body: {} }
      );

      if (testError) {
        console.warn("Suscripcion guardada, pero fallo la prueba push:", testError);
      }

      return Boolean(testError);
    } catch (enableError) {
      setError(enableError.message || "No fue posible activar Web Push.");
      throw enableError;
    } finally {
      setLoading(false);
    }
  }, [getRegistration, publicKey, supported, usuarioId]);

  const disable = useCallback(async () => {
    if (!supported || !usuarioId) return;

    setLoading(true);
    setError("");

    try {
      const registration = await getRegistration();
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const { error: deleteError } = await supabase
          .from("web_push_subscriptions")
          .delete()
          .eq("user_id", usuarioId)
          .eq("endpoint", subscription.endpoint);

        if (deleteError) throw deleteError;
        await subscription.unsubscribe();
      }

      setSubscribed(false);
    } catch (disableError) {
      setError(disableError.message || "No fue posible desactivar Web Push.");
      throw disableError;
    } finally {
      setLoading(false);
    }
  }, [getRegistration, supported, usuarioId]);

  return {
    supported,
    configured: Boolean(publicKey),
    permission,
    subscribed,
    loading,
    error,
    enable,
    disable,
  };
}
