import { useEffect, useState } from "react";
import { Plus, Share2, Users, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BottomNavigation from "../components/BottomNavigation";
import {
  crearLigaPrivada,
  obtenerLigasUsuario,
  unirseALigaPorCodigo,
} from "../services/privateLeaguesApi";
import { compartirContenido } from "../utils/shareContent";

function LigasPage({ session }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const usuarioId = session?.user?.id;
  const codigoInvitacion = searchParams.get("codigo")?.trim().toUpperCase() || "";
  const [ligas, setLigas] = useState([]);
  const [modalActivo, setModalActivo] = useState(() =>
    codigoInvitacion ? "unirse" : ""
  );
  const [nombreLiga, setNombreLiga] = useState("");
  const [codigoLiga, setCodigoLiga] = useState(codigoInvitacion);
  const [mensaje, setMensaje] = useState("");
  const [notificacion, setNotificacion] = useState("");
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    let respuestaCancelada = false;

    if (!usuarioId) {
      return undefined;
    }

    obtenerLigasUsuario(usuarioId)
      .then((ligasCargadas) => {
        if (!respuestaCancelada) {
          setLigas(ligasCargadas);
        }
      })
      .catch((error) => {
        console.error("Error al cargar las ligas:", error);

        if (!respuestaCancelada) {
          setNotificacion(
            "No se pudieron cargar tus ligas. Intenta recargar la página."
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
  }, [usuarioId]);

  const cargarLigas = async () => {
    if (!usuarioId) {
      return;
    }

    setCargando(true);

    try {
      const ligasCargadas = await obtenerLigasUsuario(usuarioId);
      setLigas(ligasCargadas);
    } catch (error) {
      console.error("Error al cargar las ligas:", error);

      setNotificacion("No se pudieron cargar tus ligas. Intenta nuevamente.");
    } finally {
      setCargando(false);
    }
  };

  const abrirModal = (tipo) => {
    setModalActivo(tipo);
    setNombreLiga("");
    setCodigoLiga("");
    setMensaje("");
    setNotificacion("");
  };

  const cerrarModal = (forzar = false) => {
    if (procesando && !forzar) {
      return;
    }

    setModalActivo("");
    setNombreLiga("");
    setCodigoLiga("");
    setMensaje("");
  };

  const crearLiga = async (event) => {
    event.preventDefault();

    const nombreNormalizado = nombreLiga.trim();

    if (nombreNormalizado.length < 3) {
      setMensaje("El nombre de la liga debe tener al menos 3 caracteres.");
      return;
    }

    if (!usuarioId) {
      setMensaje("No encontramos tu sesión. Inicia sesión nuevamente.");
      return;
    }

    setProcesando(true);
    setMensaje("");

    try {
      const ligaCreada = await crearLigaPrivada({
        nombre: nombreNormalizado,
        usuarioId,
      });

      cerrarModal(true);
      await cargarLigas();

      setNotificacion(
        `¡Liga creada! Comparte este código con tus amigos: ${ligaCreada.codigo}`
      );
    } catch (error) {
      console.error("Error al crear la liga:", error);

      setMensaje(
        error.message || "No fue posible crear la liga. Intenta nuevamente."
      );
    } finally {
      setProcesando(false);
    }
  };

  const unirseALiga = async (event) => {
    event.preventDefault();

    const codigoNormalizado = codigoLiga.trim().toUpperCase();

    if (!codigoNormalizado) {
      setMensaje("Ingresa el código de invitación.");
      return;
    }

    if (!usuarioId) {
      setMensaje("No encontramos tu sesión. Inicia sesión nuevamente.");
      return;
    }

    setProcesando(true);
    setMensaje("");

    try {
      const liga = await unirseALigaPorCodigo(codigoNormalizado, usuarioId);

      cerrarModal(true);
      await cargarLigas();

      setNotificacion(`¡Te uniste a "${liga.nombre}" correctamente!`);
    } catch (error) {
      console.error("Error al unirse a la liga:", error);

      setMensaje(
        error.message || "No fue posible unirse a la liga. Intenta nuevamente."
      );
    } finally {
      setProcesando(false);
    }
  };

  const abrirLiga = (ligaId) => {
    navigate(`/ligas/${ligaId}`);
  };

  const manejarTecladoLiga = (event, ligaId) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      abrirLiga(ligaId);
    }
  };

  const compartirLiga = async (event, liga) => {
    event.stopPropagation();
    const url = `${window.location.origin}/ligas?codigo=${encodeURIComponent(liga.codigo)}`;

    try {
      const result = await compartirContenido({
        title: `Liga ${liga.nombre} en PrediGol`,
        text: `Únete a mi liga "${liga.nombre}" con el código ${liga.codigo}.`,
        url,
      });
      setNotificacion(result === "copied" ? "Invitación copiada al portapapeles." : "Invitación compartida.");
    } catch (shareError) {
      if (shareError.name !== "AbortError") {
        setNotificacion(shareError.message || "No fue posible compartir la liga.");
      }
    }
  };

  return (
    <main className="league-page">
      <header className="league-header">
        <p className="brand">PREDIGOL</p>
        <h1>Tus ligas</h1>
        <p>
          Compite con tus amigos, demuestra que sabes de fútbol y sube en la
          tabla.
        </p>
      </header>

      <section className="league-actions">
        <button
          className="create-league-button"
          type="button"
          onClick={() => abrirModal("crear")}
        >
          <Plus size={19} />
          Crear liga
        </button>

        <button
          className="join-league-button"
          type="button"
          onClick={() => abrirModal("unirse")}
        >
          Unirse con código
        </button>
      </section>

      {notificacion && (
        <p className="league-page-message" role="status">
          {notificacion}
        </p>
      )}

      <section className="league-section-header">
        <div>
          <p className="section-label">MIS LIGAS</p>
          <h2>Competencias activas</h2>
        </div>

        <span>
          {ligas.length} {ligas.length === 1 ? "liga" : "ligas"}
        </span>
      </section>

      {cargando ? (
        <section className="empty-league-card">
          <p>Cargando tus ligas...</p>
          <span>Estamos preparando tu cancha.</span>
        </section>
      ) : ligas.length === 0 ? (
        <section className="empty-league-card">
          <p>Todavía no perteneces a ninguna liga.</p>
          <span>
            Crea una liga privada o únete con un código.
          </span>
        </section>
      ) : (
        <section className="leagues-list">
          {ligas.map((liga) => (
            <article
              className="league-card league-card-button"
              key={liga.id}
              role="button"
              tabIndex={0}
              aria-label={`Abrir liga ${liga.nombre}`}
              onClick={() => abrirLiga(liga.id)}
              onKeyDown={(event) => manejarTecladoLiga(event, liga.id)}
            >
              <div className="league-icon">
                <Users size={22} />
              </div>

              <div className="league-info">
                <h3>{liga.nombre}</h3>

                <p>
                  {liga.participantes}{" "}
                  {liga.participantes === 1
                    ? "participante"
                    : "participantes"}{" "}
                  · Código <strong>{liga.codigo}</strong>
                </p>
              </div>

              <div className="league-position">
                <span>Tu posición</span>
                <strong>—</strong>
              </div>

              <button
                type="button"
                className="league-share-button"
                aria-label={`Compartir liga ${liga.nombre}`}
                onClick={(event) => compartirLiga(event, liga)}
              >
                <Share2 size={17} />
              </button>
            </article>
          ))}
        </section>
      )}

      {!cargando && ligas.length > 0 && (
        <section className="empty-league-card">
          <p>¿Quieres competir con más personas?</p>
          <span>
            Crea una liga privada y comparte el código con tus amigos.
          </span>
        </section>
      )}

      {modalActivo === "crear" && (
        <div className="modal-overlay">
          <section className="league-modal">
            <button
              className="modal-close-button"
              type="button"
              onClick={() => cerrarModal()}
              disabled={procesando}
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>

            <p className="section-label">NUEVA LIGA</p>
            <h2>Crea tu competencia</h2>
            <p className="modal-description">
              Ponle un nombre a tu liga y comparte el código con tus amigos.
            </p>

            <form onSubmit={crearLiga}>
              <label htmlFor="nombreLiga">Nombre de la liga</label>

              <input
                id="nombreLiga"
                type="text"
                maxLength="60"
                placeholder="Ejemplo: Los duros del barrio"
                value={nombreLiga}
                onChange={(event) => setNombreLiga(event.target.value)}
                disabled={procesando}
                autoFocus
              />

              {mensaje && <p className="modal-message">{mensaje}</p>}

              <button
                className="modal-primary-button"
                type="submit"
                disabled={procesando}
              >
                {procesando ? "Creando liga..." : "Crear liga"}
              </button>
            </form>
          </section>
        </div>
      )}

      {modalActivo === "unirse" && (
        <div className="modal-overlay">
          <section className="league-modal">
            <button
              className="modal-close-button"
              type="button"
              onClick={() => cerrarModal()}
              disabled={procesando}
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>

            <p className="section-label">UNIRSE A UNA LIGA</p>
            <h2>Ingresa el código</h2>
            <p className="modal-description">
              Pídele el código al creador de la liga para entrar a competir.
            </p>

            <form onSubmit={unirseALiga}>
              <label htmlFor="codigoLiga">Código de invitación</label>

              <input
                id="codigoLiga"
                type="text"
                maxLength="10"
                placeholder="Ejemplo: PREDIABC23"
                value={codigoLiga}
                onChange={(event) =>
                  setCodigoLiga(event.target.value.toUpperCase())
                }
                disabled={procesando}
                autoFocus
              />

              {mensaje && <p className="modal-message">{mensaje}</p>}

              <button
                className="modal-primary-button"
                type="submit"
                disabled={procesando}
              >
                {procesando ? "Uniéndote..." : "Unirme a la liga"}
              </button>
            </form>
          </section>
        </div>
      )}

      <BottomNavigation activePage="ligas" />
    </main>
  );
}

export default LigasPage;
