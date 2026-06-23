import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useProfile(userId) {
  const [perfilCargado, setPerfilCargado] = useState({
    userId: null,
    profile: null,
  });

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    let componenteActivo = true;

    const cargarPerfil = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nombre, username, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      if (!componenteActivo) {
        return;
      }

      if (error) {
        console.error("No fue posible cargar el perfil:", error.message);

        setPerfilCargado({
          userId,
          profile: null,
        });

        return;
      }

      setPerfilCargado({
        userId,
        profile: data,
      });
    };

    cargarPerfil();

    return () => {
      componenteActivo = false;
    };
  }, [userId]);

  const perfilCorrespondeAlUsuario = perfilCargado.userId === userId;

  return {
    profile: perfilCorrespondeAlUsuario ? perfilCargado.profile : null,
    loadingProfile: Boolean(userId && !perfilCorrespondeAlUsuario),
  };
}