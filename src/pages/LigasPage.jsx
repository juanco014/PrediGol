import { useEffect, useState } from "react";
import { Plus, Users, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNavigation from "../components/BottomNavigation";
import { supabase } from "../lib/supabase";

function generarCodigoLiga() {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo = "PREDI";
  const valoresAleatorios = new Uint32Array(5);

  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(valoresAleatorios);
  } else {
    for (let index = 0; index < valoresAleatorios.length; index += 1) {
      valoresAleatorios[index] = Math.floor(Math.random() * 100000);
    }
  }

  for (const valor of valoresAleatorios) {
    const posicion = valor % caracteres.length;
    codigo += caracteres[posicion];
  }

  return codigo;
}

async function consultarMisLigas() {
  const { data, error } = await supabase.rpc("obtener_mis_ligas");

  if (error) {
    throw error;
  }

  return data || [];
}

function LigasPage({ session }) {
  const [ligas, setLigas] = useState([]);
  const [modalActivo, setModalActivo] = useState("");
  const [nombreLiga, setNombreLiga] = useState("");
  const [codigoLiga, setCodigoLiga] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [notificacion, setNotificacion] = useState("");
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  const navigate = useNavigate();
  const usuarioId = session?.user?.id;

  useEffect(() => {
    let respuestaCancelada = false;

    if (!usuarioId) {
      return undefined;
    }

    consultarMisLigas()
      .then((ligasCargadas) => {
        if (!respuestaCancelada) {
          setLigas(ligasCargadas);
        }
      })
      .catch((error) => {
        console.error("Error al cargar las ligas:", error);

        if (!respuestaCancelada) {
          setNotificacion(
            "No fue posible cargar tus ligas. Intenta recargar la página."
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
      const ligasCargadas = await consultarMisLigas();
      setLigas(ligasCargadas);
    } catch (error) {
      console.error("Error al cargar las ligas:", error);

      setNotificacion(
        "No fue posible actualizar tus ligas. Intenta nuevamente."
      );
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
      let ligaCreada = null;

      for (let intento = 0; intento < 5; intento += 1) {
        const codigo = generarCodigoLiga();

        const { data, error } = await supabase
          .from("ligas")
          .insert({
            nombre: nombreNormalizado,
            codigo,
            creador_id: usuarioId,
          })
          .select("id, nombre, codigo")
          .single();

        if (!error) {
          ligaCreada = data;
          break;
        }

        if (error.code !== "23505") {
          throw error;
        }
      }

      if (!ligaCreada) {
        throw new Error(
          "No fue posible generar un código único. Intenta nuevamente."
        );
      }

      const { error: errorMiembroCreador } = await supabase
        .from("liga_miembros")
        .upsert(
          {
            liga_id: ligaCreada.id,
            usuario_id: usuarioId,
          },
          {
            onConflict: "liga_id,usuario_id",
            ignoreDuplicates: true,
          }
        );

      if (errorMiembroCreador) {
        throw errorMiembroCreador;
      }

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
      const { data: liga, error: errorLiga } = await supabase
        .from("ligas")
        .select("id, nombre, codigo")
        .eq("codigo", codigoNormalizado)
        .maybeSingle();

      if (errorLiga) {
        throw errorLiga;
      }

      if (!liga) {
        setMensaje("No encontramos una liga con ese código.");
        return;
      }

      const { error: errorUnion } = await supabase
        .from("liga_miembros")
        .insert({
          liga_id: liga.id,
          usuario_id: usuarioId,
        });

      if (errorUnion?.code === "23505") {
        setMensaje("Ya haces parte de esta liga.");
        return;
      }

      if (errorUnion) {
        throw errorUnion;
      }

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
          <p>Cargando tus competencias...</p>
          <span>Estamos preparando tu cancha.</span>
        </section>
      ) : ligas.length === 0 ? (
        <section className="empty-league-card">
          <p>Aún no haces parte de ninguna liga.</p>
          <span>
            Crea una liga privada o usa el código que te compartió un amigo.
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
