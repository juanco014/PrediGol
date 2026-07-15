import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  correoTieneFormatoValido,
  obtenerMensajeErrorAuth,
  solicitarRecuperacionContrasena,
} from "../services/userAccountApi";

const MENSAJE_RECUPERACION =
  "Si existe una cuenta asociada a ese correo, recibirás instrucciones para restablecer tu contraseña.";

function RecuperarContrasenaPage() {
  const navigate = useNavigate();
  const [correo, setCorreo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("");

  const manejarEnvio = async (event) => {
    event.preventDefault();

    if (cargando) return;

    setMensaje("");
    setTipoMensaje("");

    const correoLimpio = correo.trim().toLowerCase();

    if (!correoLimpio) {
      setMensaje("Escribe tu correo electrónico.");
      setTipoMensaje("error");
      return;
    }

    if (!correoTieneFormatoValido(correoLimpio)) {
      setMensaje("Escribe un correo electrónico válido.");
      setTipoMensaje("error");
      return;
    }

    try {
      setCargando(true);
      await solicitarRecuperacionContrasena({ correo: correoLimpio });
      setMensaje(MENSAJE_RECUPERACION);
      setTipoMensaje("success");
    } catch (error) {
      setMensaje(
        obtenerMensajeErrorAuth(
          error,
          "No pudimos procesar la solicitud. Inténtalo de nuevo en unos minutos."
        )
      );
      setTipoMensaje("error");
    } finally {
      setCargando(false);
    }
  };

  const mensajeId = mensaje ? "recuperacion-mensaje" : undefined;

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-intro">
          <button
            className="auth-back-button"
            type="button"
            onClick={() => navigate("/auth")}
          >
            <ArrowLeft size={18} />
            Volver al login
          </button>

          <p className="brand">PREDIGOL</p>

          <h1>
            Recupera tu acceso
            <span> a PrediGol.</span>
          </h1>

          <p>
            Te enviaremos instrucciones seguras para crear una nueva contraseña
            si el correo corresponde a una cuenta existente.
          </p>
        </div>

        <section className="auth-card">
          <div className="auth-card-heading">
            <p className="section-label">RECUPERACIÓN</p>
            <h2>Restablecer contraseña</h2>
            <span>Ingresa el correo con el que creaste tu cuenta.</span>
          </div>

          <form className="auth-form" onSubmit={manejarEnvio}>
            <label className="auth-field" htmlFor="correo-recuperacion">
              <span>Correo electrónico</span>

              <div>
                <Mail size={18} />
                <input
                  id="correo-recuperacion"
                  type="email"
                  placeholder="tucorreo@ejemplo.com"
                  value={correo}
                  onChange={(event) => setCorreo(event.target.value)}
                  autoComplete="email"
                  aria-describedby={mensajeId}
                  disabled={cargando}
                />
              </div>
            </label>

            {mensaje && (
              <p
                id="recuperacion-mensaje"
                className={`auth-message ${tipoMensaje}`}
                role={tipoMensaje === "error" ? "alert" : "status"}
              >
                {mensaje}
              </p>
            )}

            <button
              className="auth-submit-button"
              type="submit"
              disabled={cargando}
            >
              {cargando ? "Enviando..." : "Enviar instrucciones"}
            </button>
          </form>

          <p className="auth-switch-text">
            ¿Recordaste tu contraseña?
            <button type="button" onClick={() => navigate("/auth")}>
              Ingresar
            </button>
          </p>
        </section>
      </section>
    </main>
  );
}

export default RecuperarContrasenaPage;
