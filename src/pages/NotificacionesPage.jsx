import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock3,
  Radio,
  Trophy,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNavigation from "../components/BottomNavigation";
import LoadingState from "../components/LoadingState";
import { supabase } from "../lib/supabase";
import {
  calcularDetallePuntaje,
  partidoAceptaPronosticos,
} from "../utils/estadisticas";
import { obtenerCuentaRegresiva } from "../utils/fechasPartidos";

const MAX_AVISOS = 20;

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
          id,
          torneo,
          fecha_orden,
          local_nombre,
          visitante_nombre,
          estado,
          goles_local_final,
          goles_visitante_final,
          es_relevante
        `
      )
      .eq("es_relevante", true)
      .order("fecha_orden", { ascending: false })
      .limit(50),
    supabase
      .from("pronosticos")
      .select("partido_id, goles_local, goles_visitante")
      .eq("usuario_id", usuarioId),
  ]);

  if (respuestaPartidos.error) {
    throw respuestaPartidos.error;
  }

  if (respuestaPronosticos.error) {
    throw respuestaPronosticos.error;
  }

  return {
    partidos: (respuestaPartidos.data || []).map(adaptarPartido),
    pronosticos: Object.fromEntries(
      (respuestaPronosticos.data || []).map((pronostico) => [
        pronostico.partido_id,
        {
          local: pronostico.goles_local,
          visitante: pronostico.goles_visitante,
        },
      ])
    ),
  };
}

function construirAvisos(partidos, pronosticos, ahora) {
  return partidos
    .map((partido) => {
      const pronostico = pronosticos[partido.id];
      const cuentaRegresiva = obtenerCuentaRegresiva(partido.fechaOrden, ahora);
      const equipos = `${partido.local} vs ${partido.visitante}`;

      if (partido.estado === "en_vivo") {
        return {
          id: `live-${partido.id}`,
          partidoId: partido.id,
          tipo: "live",
          prioridad: 0,
          fecha: partido.fechaOrden,
          titulo: "Partido en vivo",
          detalle: `${equipos} ya esta en juego.`,
          etiqueta: "Ver partido",
          icono: Radio,
        };
      }

      if (partidoAceptaPronosticos(partido, ahora) && cuentaRegresiva?.dentroDe72Horas) {
        if (!pronostico) {
          return {
            id: `pending-${partido.id}`,
            partidoId: partido.id,
            tipo: "pending",
            prioridad: 1,
            fecha: partido.fechaOrden,
            titulo: "Te falta pronosticar",
            detalle: `${equipos}. ${cuentaRegresiva.texto}.`,
            etiqueta: "Pronosticar",
            icono: Clock3,
          };
        }

        return {
          id: `ready-${partido.id}`,
          partidoId: partido.id,
          tipo: "ready",
          prioridad: 2,
          fecha: partido.fechaOrden,
          titulo: "Pronostico listo",
          detalle: `${equipos}: guardaste ${pronostico.local} - ${pronostico.visitante}. ${cuentaRegresiva.texto}.`,
          etiqueta: "Revisar",
          icono: CheckCircle2,
        };
      }

      if (partido.estado === "finalizado" && pronostico && partido.resultadoFinal) {
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
        };
      }

      return null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.prioridad !== b.prioridad) {
        return a.prioridad - b.prioridad;
      }

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
  const [momentoActual, setMomentoActual] = useState(() => new Date());
  const [versionDatos, setVersionDatos] = useState(0);

  useEffect(() => {
    let respuestaCancelada = false;

    if (!usuarioId) {
      return () => {
        respuestaCancelada = true;
      };
    }

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
          setError(
            errorCarga.message || "No fue posible cargar tus notificaciones."
          );
        }
      })
      .finally(() => {
        if (!respuestaCancelada) {
          setCargando(false);
        }
      });

    return () => {
      respuestaCancelada = true;
    };
  }, [usuarioId, versionDatos]);

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      setMomentoActual(new Date());
    }, 30000);

    const canal = supabase
      .channel("predigol-notificaciones-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "partidos" },
        () => setVersionDatos((version) => version + 1)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pronosticos" },
        () => setVersionDatos((version) => version + 1)
      )
      .subscribe();

    return () => {
      window.clearInterval(intervalo);
      supabase.removeChannel(canal);
    };
  }, []);

  const avisos = useMemo(
    () => construirAvisos(partidos, pronosticos, momentoActual),
    [momentoActual, partidos, pronosticos]
  );

  const pendientes = avisos.filter((aviso) => aviso.tipo === "pending").length;

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

      {cargando ? (
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
                <div className="notification-icon">
                  <Icono size={20} />
                </div>
                <div>
                  <span>{aviso.titulo}</span>
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
