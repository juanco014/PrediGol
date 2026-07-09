import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  reminder_24h: true,
  reminder_1h: true,
  kickoff_updates: true,
  result_updates: true,
  favorite_updates: true,
};

export function useNotificationPreferences(usuarioId) {
  const [preferences, setPreferences] = useState(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    if (!usuarioId) {
      return () => {
        active = false;
      };
    }

    supabase
      .from("user_notification_preferences")
      .select(
        "reminder_24h, reminder_1h, kickoff_updates, result_updates, favorite_updates"
      )
      .eq("user_id", usuarioId)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (queryError) {
          throw queryError;
        }

        if (active) {
          setPreferences(data || DEFAULT_NOTIFICATION_PREFERENCES);
          setError("");
        }
      })
      .catch((queryError) => {
        console.error("Error al cargar preferencias:", queryError);

        if (active) {
          setError(
            queryError.message || "No fue posible cargar tus preferencias."
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [usuarioId]);

  const savePreferences = useCallback(
    async (nextPreferences) => {
      if (!usuarioId) {
        return;
      }

      const normalized = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...nextPreferences,
      };

      setSaving(true);
      setError("");

      try {
        const { error: saveError } = await supabase
          .from("user_notification_preferences")
          .upsert(
            {
              user_id: usuarioId,
              ...normalized,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );

        if (saveError) {
          throw saveError;
        }

        setPreferences(normalized);
      } catch (saveError) {
        setError(saveError.message || "No fue posible guardar tus preferencias.");
        throw saveError;
      } finally {
        setSaving(false);
      }
    },
    [usuarioId]
  );

  return {
    preferences,
    setPreferences,
    loading,
    saving,
    error,
    savePreferences,
  };
}
