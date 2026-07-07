import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  BellRing,
  CheckCircle2,
  Clock3,
  Heart,
  Radio,
  Settings2,
  Smartphone,
  Trophy,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNavigation from "../components/BottomNavigation";
import LoadingState from "../components/LoadingState";
import { useFavorites } from "../hooks/useFavorites";
import { useNotificationPreferences } from "../hooks/useNotificationPreferences";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { supabase } from "../lib/supabase";
import {
  calcularDetallePuntaje,
  partidoAceptaPronosticos,
} from "../utils/estadisticas";
import { obtenerCuentaRegresiva } from "../utils/fechasPartidos";

const MAX_AVISOS = 20;
const HORA_MS = 60 * 60 * 1000;

const PREFERENCE_OPTIONS = [
  ["reminder_24h", "Recordatorio 24 horas", "Avísame si falta mi pronostico."],
  ["reminder_1h", "Recordatorio 1 hora", "Ultimo aviso antes del cierre."],
  ["kickoff_updates", "Inicio del partido", "Muestra cuando un juego entra en vivo."],
  ["result_updates", "Resultados y puntos", "Muestra el marcador y los puntos obtenidos."],
  ["favorite_updates", "Equipos y torneos favoritos", "Prioriza noticias de lo que sigo."],
];

function adaptarPartido(partido) {
  return {
    id: partido.id,
    torneo: partido.torneo,
    fechaOrden: partido.fecha_orden,
    local: partido.local_nombre,
    visitante: partido.visitante_nombre,
    estado: partido.estado,
    resultadoFinal:
      partido.estado === "finalizado" &&
      partido.goles_local_final !== null &&
      partido.goles_visitante_final !== null
        ? {
            local: partido.goles_local_final,
            visitante: partido.goles_visitante_final,
          }
        : null,
  };
}

async function consultarDatosNotificaciones(usuarioId) {
  const [respuestaPartidos, respuestaPronosticos] = await Promise.all([
    supabase
      .from("partidos")
      .select(
        `
          id, torneo, fecha_orden, local_nombre, visitante_nombre, estado,
          goles_local_final, goles_visitante_final, es_relevante
        `
      )
      .eq("es_relevante", true)
      .order("fecha_orden", { ascending: false })
      .limit(80),
    supabase
      .from("pronosticos")
      .select("partido_id, goles_local, goles_visitante")
      .eq("usuario_id", usuarioId),
  ]);

  if (respuestaPartidos.error) throw respuestaPartidos.error;
  if (respuestaPronosticos.error) throw respuestaPronosticos.error;

  return {
    partidos: (respuestaPartidos.data || []).map(adaptarPartido),
    pronosticos: Object.fromEntries(
      (respuestaPronosticos.data || []).map((pronostico) => [
        pronostico.partido_id,
        { local: pronostico.goles_local, visitante: pronostico.goles_visitante },
      ])
    ),
  };
}

function construirAvisos(partidos, pronosticos, ahora, preferences, favorites) {
  return partidos
    .map((partido) => {
      const pronostico = pronosticos[partido.id];
      const cuentaRegresiva = obtenerCuentaRegresiva(partido.fechaOrden, ahora);
      const equipos = `${partido.local} vs ${partido.visitante}`;
      const esFavorito =
        favorites.isTeamFavorite(partido.local) ||
        favorites.isTeamFavorite(partido.visitante) ||
        favorites.isCompetitionFavorite(partido.torneo);
      const avisoFavorito = preferences.favorite_updates && esFavorito;

      if (
        partido.estado === "en_vivo" &&
        (preferences.kickoff_updates || avisoFavorito)
      ) {
        return {
          id: `live-${partido.id}`,
          partidoId: partido.id,
          tipo: "live",
          prioridad: 0,
          fecha: partido.fechaOrden,
          titulo: avisoFavorito ? "Tu favorito esta en vivo" : "Partido en vivo",
          detalle: `${equipos} ya esta en juego.`,
          etiqueta: "Ver partido",
          icono: Radio,
          favorito: esFavorito,
        };
      }

      if (partidoAceptaPronosticos(partido, ahora) && cuentaRegresiva) {
        if (!pronostico && cuentaRegresiva.restante <= HORA_MS && preferences.reminder_1h) {
          return {
            id: `pending-1h-${partido.id}`,
            partidoId: partido.id,
            tipo: "pending-urgent",
            prioridad: 0,
            fecha: partido.fechaOrden,
            titulo: "Ultima hora para pronosticar",
            detalle: `${equipos}. ${cuentaRegresiva.texto}.`,
            etiqueta: "Pronosticar",
            icono: Clock3,
            favorito: esFavorito,
          };
        }

        if (!pronostico && cuentaRegresiva.restante <= 24 * HORA_MS && preferences.reminder_24h) {
          return {
            id: `pending-24h-${partido.id}`,
            partidoId: partido.id,
            tipo: "pending",
            prioridad: 1,
            fecha: partido.fechaOrden,
            titulo: "Te falta pronosticar",
            detalle: `${equipos}. ${cuentaRegresiva.texto}.`,
            etiqueta: "Pronosticar",
            icono: Clock3,
            favorito: esFavorito,
          };
        }

        if (avisoFavorito && cuentaRegresiva.dentroDe72Horas) {
          return {
            id: `favorite-${partido.id}`,
            partidoId: partido.id,
            tipo: "favorite",
            prioridad: 2,
            fecha: partido.fechaOrden,
            titulo: pronostico ? "Tu favorito se acerca" : "Partido de tu favorito",
            detalle: pronostico
              ? `${equipos}: guardaste ${pronostico.local} - ${pronostico.visitante}. ${cuentaRegresiva.texto}.`
              : `${equipos}. ${cuentaRegresiva.texto}.`,
            etiqueta: pronostico ? "Revisar" : "Pronosticar",
            icono: Heart,
            favorito: true,
          };
        }
      }

      if (partido.estado === "finalizado" && partido.resultadoFinal) {
        if (pronostico && preferences.result_updates) {
          const detallePuntaje = calcularDetallePuntaje(
            pronostico,
            partido.resultadoFinal
          );

          return {
            id: `result-${partido.id}`,
            partidoId: partido.id,
            tipo: detallePuntaje.puntos > 0 ? "result-win" : "result",
            prioridad: 3,
            fecha: partido.fechaOrden,
            titulo:
              detallePuntaje.puntos > 0
                ? `Sumaste ${detallePuntaje.puntos} puntos`
                : "Resultado disponible",
            detalle: `${equipos} termino ${partido.resultadoFinal.local} - ${partido.resultadoFinal.visitante}.`,
            etiqueta: "Ver resultado",
            icono: Trophy,
            favorito: esFavorito,
          };
        }

        if (avisoFavorito) {
          return {
            id: `favorite-result-${partido.id}`,
            partidoId: partido.id,
            tipo: "favorite",
            prioridad: 4,
            fecha: partido.fechaOrden,
            titulo: "Resultado de tu favorito",
            detalle: `${equipos} termino ${partido.resultadoFinal.local} - ${partido.resultadoFinal.visitante}.`,
            etiqueta: "Ver resultado",
            icono: Heart,
            favorito: true,
          };
        }
      }

      return null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    })
    .slice(0, MAX_AVISOS);
}

function NotificacionesPage({ session }) {
  const navigate = useNavigate();
  const usuarioId = session?.user?.id;
  const [partidos, setPartidos] = useState([]);
  const [pronosticos, setPronosticos] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [preferenciasMensaje, setPreferenciasMensaje] = useState("");
  const [momentoActual, setMomentoActual] = useState(() => new Date());
  const [versionDatos, setVersionDatos] = useState(0);
  const favorites = useFavorites(usuarioId);
  const notificationPreferences = useNotificationPreferences(usuarioId);
  const pushNotifications = usePushNotifications(usuarioId);

  useEffect(() => {
    let respuestaCancelada = false;
    if (!usuarioId) return () => { respuestaCancelada = true; };

    consultarDatosNotificaciones(usuarioId)
      .then((datos) => {
        if (!respuestaCancelada) {
          setPartidos(datos.partidos);
          setPronosticos(datos.pronosticos);
          setError("");
        }
      })
      .catch((errorCarga) => {
        console.error("Error al cargar notificaciones:", errorCarga);
        if (!respuestaCancelada) {
          setError(errorCarga.message || "No fue posible cargar tus notificaciones.");
        }
      })
      .finally(() => {
        if (!respuestaCancelada) setCargando(false);
      });

    return () => { respuestaCancelada = true; };
  }, [usuarioId, versionDatos]);

  useEffect(() => {
    const intervalo = window.setInterval(() => setMomentoActual(new Date()), 30000);
    const canal = supabase
      .channel("predigol-notificaciones-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "partidos" }, () =>
        setVersionDatos((version) => version + 1)
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "pronosticos" }, () =>
        setVersionDatos((version) => version + 1)
      )
      .subscribe();

    return () => {
      window.clearInterval(intervalo);
      supabase.removeChannel(canal);
    };
  }, []);

  const avisos = useMemo(
    () =>
      construirAvisos(
        partidos,
        pronosticos,
        momentoActual,
        notificationPreferences.preferences,
        favorites
      ),
    [favorites, momentoActual, notificationPreferences.preferences, partidos, pronosticos]
  );

  const pendientes = avisos.filter((aviso) => aviso.tipo.startsWith("pending")).length;

  const cambiarPreferencia = async (preferenceKey) => {
    const nextPreferences = {
      ...notificationPreferences.preferences,
      [preferenceKey]: !notificationPreferences.preferences[preferenceKey],
    };
    notificationPreferences.setPreferences(nextPreferences);
    setPreferenciasMensaje("");

    try {
      await notificationPreferences.savePreferences(nextPreferences);
      setPreferenciasMensaje("Preferencias guardadas.");
    } catch (saveError) {
      console.error("Error al guardar preferencias:", saveError);
      setPreferenciasMensaje(
        saveError.message || "No fue posible guardar tus preferencias."
      );
    }
  };

  const cambiarPush = async () => {
    setPreferenciasMensaje("");
    try {
      if (pushNotifications.subscribed) {
        await pushNotifications.disable();
        setPreferenciasMensaje("Notificaciones Web Push desactivadas.");
      } else {
        const testFailed = await pushNotifications.enable();
        setPreferenciasMensaje(
          testFailed
            ? "Suscripcion guardada. La prueba se enviara al completar los secretos VAPID."
            : "Web Push activado y notificacion de prueba enviada."
        );
      }
    } catch (pushError) {
      setPreferenciasMensaje(
        pushError.message || "No fue posible cambiar Web Push."
      );
    }
  };

  return (
    <main className="notifications-page">
      <header className="notifications-header">
        <button type="button" onClick={() => navigate("/inicio")}>
          <ArrowLeft size={19} />
          Volver
        </button>
        <div>
          <p className="section-label">CENTRO DE AVISOS</p>
          <h1>Notificaciones</h1>
          <span>
            {pendientes > 0
              ? `${pendientes} ${pendientes === 1 ? "partido requiere" : "partidos requieren"} tu pronostico.`
              : "Estas al dia con tus partidos relevantes."}
          </span>
        </div>
        <div className="notifications-bell" aria-hidden="true">
          <Bell size={23} />
          {pendientes > 0 && <b>{pendientes}</b>}
        </div>
      </header>

      <section className="notification-preferences">
        <div className="notification-preferences-title">
          <Settings2 size={19} />
          <div>
            <p className="section-label">PREFERENCIAS</p>
            <h2>Que quieres recibir</h2>
          </div>
        </div>
        <div className="notification-preference-list">
          {PREFERENCE_OPTIONS.map(([key, title, description]) => (
            <label key={key}>
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <input
                type="checkbox"
                checked={Boolean(notificationPreferences.preferences[key])}
                disabled={notificationPreferences.loading || notificationPreferences.saving}
                onChange={() => cambiarPreferencia(key)}
              />
            </label>
          ))}
        </div>
        {(preferenciasMensaje || notificationPreferences.error) && (
          <p className="notification-preferences-message">
            {preferenciasMensaje || notificationPreferences.error}
          </p>
        )}
      </section>

      <section className="push-settings-card">
        <div className="push-settings-icon">
          {pushNotifications.subscribed ? <BellRing size={22} /> : <Smartphone size={22} />}
        </div>
        <div>
          <p className="section-label">WEB PUSH</p>
          <h2>Avisos con PrediGol cerrado</h2>
          <span>
            {!pushNotifications.supported
              ? "Este navegador no soporta notificaciones push."
              : !pushNotifications.configured
                ? "Falta configurar la llave publica VAPID en el despliegue."
                : pushNotifications.permission === "denied"
                  ? "El navegador bloqueo las notificaciones. Debes habilitarlas desde sus permisos."
                  : pushNotifications.subscribed
                    ? "Este dispositivo esta suscrito a notificaciones."
                    : "Activa este dispositivo y recibe una notificacion de prueba."}
          </span>
        </div>
        <button
          type="button"
          onClick={cambiarPush}
          disabled={
            !pushNotifications.supported ||
            !pushNotifications.configured ||
            pushNotifications.loading ||
            pushNotifications.permission === "denied"
          }
        >
          {pushNotifications.loading
            ? "Procesando..."
            : pushNotifications.subscribed
              ? "Desactivar"
              : "Activar Web Push"}
        </button>
        {pushNotifications.error && (
          <p className="push-settings-error">{pushNotifications.error}</p>
        )}
      </section>

      {cargando || favorites.loading ? (
        <LoadingState cards={3} label="Cargando tus notificaciones" />
      ) : error ? (
        <section className="empty-league-card">
          <p>No pudimos cargar tus avisos.</p>
          <span>{error}</span>
        </section>
      ) : avisos.length === 0 ? (
        <section className="notifications-empty">
          <CheckCircle2 size={30} />
          <p>No tienes avisos pendientes.</p>
          <span>Los proximos partidos y resultados apareceran aqui.</span>
        </section>
      ) : (
        <section className="notifications-list">
          {avisos.map((aviso) => {
            const Icono = aviso.icono;
            return (
              <article
                className={`notification-card notification-${aviso.tipo}`}
                key={aviso.id}
              >
                <div className="notification-icon"><Icono size={20} /></div>
                <div>
                  <span>
                    {aviso.titulo}
                    {aviso.favorito && <Heart size={12} fill="currentColor" />}
                  </span>
                  <strong>{aviso.detalle}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/partidos/${aviso.partidoId}`)}
                >
                  {aviso.etiqueta}
                </button>
              </article>
            );
          })}
        </section>
      )}

      <BottomNavigation activePage="notificaciones" />
    </main>
  );
}

export default NotificacionesPage;
