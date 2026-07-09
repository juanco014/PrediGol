import { useEffect, useState } from "react";
import { obtenerPerfilUsuario } from "../services/userAccountApi";

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
      try {
        const data = await obtenerPerfilUsuario(userId);

        if (!componenteActivo) {
          return;
        }

        setPerfilCargado({
          userId,
          profile: data,
        });
      } catch (error) {
        if (!componenteActivo) {
          return;
        }

        console.error("No fue posible cargar el perfil:", error.message);

        setPerfilCargado({
          userId,
          profile: null,
        });

        return;
      }
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
