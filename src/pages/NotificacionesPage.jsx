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
import {
  crearCanalRealtimeNotificaciones,
  obtenerNotificacionesPartidos,
} from "../services/notificationsApi";
import { construirAvisosPartidos } from "../services/notificationsMappers";

const PREFERENCE_OPTIONS = [
  ["reminder_24h", "Recordatorio 24 horas", "Avísame si falta mi pronóstico."],
  ["reminder_1h", "Recordatorio 1 hora", "Último aviso antes del cierre."],
  ["kickoff_updates", "Inicio del partido", "Muestra cuando un juego entra en vivo."],
  ["result_updates", "Resultados y puntos", "Muestra el marcador y los puntos obtenidos."],
  ["favorite_updates", "Equipos y torneos favoritos", "Prioriza noticias de lo que sigo."],
];

const NOTIFICATION_ICONS = {
  live: Radio,
  "pending-urgent": Clock3,
  pending: Clock3,
  favorite: Heart,
  "result-win": Trophy,
  result: Trophy,
};

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

    obtenerNotificacionesPartidos(usuarioId)
      .then((datos) => {
        if (!respuestaCancelada) {
          setPartidos(datos.partidos);
          setPronosticos(datos.pronosticos);
          setError("");
        }
      })
      .catch((errorCarga) => {
        console.error("Error al cargar notificaciones:", errorCarga);
        if (!respuestaCancelada) setError("No se pudieron cargar las notificaciones.");
      })
      .finally(() => {
        if (!respuestaCancelada) setCargando(false);
      });

    return () => { respuestaCancelada = true; };
  }, [usuarioId, versionDatos]);

  useEffect(() => {
    const intervalo = window.setInterval(() => setMomentoActual(new Date()), 30000);
    if (!usuarioId) {
      return () => window.clearInterval(intervalo);
    }

    const realtime = crearCanalRealtimeNotificaciones(undefined, () =>
      setVersionDatos((version) => version + 1)
    );

    return () => {
      window.clearInterval(intervalo);
      realtime.cleanup();
    };
  }, [usuarioId]);

  const avisos = useMemo(
    () =>
      construirAvisosPartidos(
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
            ? "Suscripción guardada. La prueba se enviará al completar los secretos VAPID."
            : "Web Push activado y notificación de prueba enviada."
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
              ? `${pendientes} ${pendientes === 1 ? "partido requiere" : "partidos requieren"} tu pronóstico.`
              : "Estás al día con tus partidos relevantes."}
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
            <h2>Qué quieres recibir</h2>
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
                ? "Falta configurar la llave pública VAPID en el despliegue."
                : pushNotifications.permission === "denied"
                  ? "El navegador bloqueó las notificaciones. Debes habilitarlas desde sus permisos."
                  : pushNotifications.subscribed
                    ? "Este dispositivo está suscrito a notificaciones."
                    : "Activa este dispositivo y recibe una notificación de prueba."}
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
          <p>No se pudieron cargar las notificaciones.</p>
          <span>{error}</span>
        </section>
      ) : avisos.length === 0 ? (
        <section className="notifications-empty">
          <CheckCircle2 size={30} />
          <p>No tienes notificaciones todavía.</p>
          <span>No hay avisos de partidos en vivo ni resultados pendientes.</span>
        </section>
      ) : (
        <section className="notifications-list">
          {avisos.map((aviso) => {
            const Icono = NOTIFICATION_ICONS[aviso.tipo] || Bell;
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
