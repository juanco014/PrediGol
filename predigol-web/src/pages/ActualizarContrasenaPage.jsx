import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  actualizarContrasena,
  cerrarSesionRecuperacion,
  obtenerMensajeErrorAuth,
  validarNuevaContrasena,
} from "../services/userAccountApi";

function ActualizarContrasenaPage({ session, recuperacionActiva }) {
  const navigate = useNavigate();
  const [contrasena, setContrasena] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("");
  const [actualizacionCompleta, setActualizacionCompleta] = useState(false);

  const tieneSesionRecuperacion = Boolean(session && recuperacionActiva);

  const limpiarCampos = () => {
    setContrasena("");
    setConfirmacion("");
  };

  const manejarEnvio = async (event) => {
    event.preventDefault();

    if (cargando || !tieneSesionRecuperacion || actualizacionCompleta) return;

    setMensaje("");
    setTipoMensaje("");

    const errorValidacion = validarNuevaContrasena(contrasena, confirmacion);

    if (errorValidacion) {
      setMensaje(errorValidacion);
      setTipoMensaje("error");
      return;
    }

    try {
      setCargando(true);
      await actualizarContrasena({ contrasena });
      limpiarCampos();
      await cerrarSesionRecuperacion();
      setActualizacionCompleta(true);
      setMensaje("Tu contraseña fue actualizada. Inicia sesión con tu nueva contraseña.");
      setTipoMensaje("success");
    } catch (error) {
      limpiarCampos();
      setMensaje(
        obtenerMensajeErrorAuth(
          error,
          "No pudimos actualizar tu contraseña. Solicita un nuevo enlace e inténtalo otra vez."
        )
      );
      setTipoMensaje("error");
    } finally {
      setCargando(false);
    }
  };

  const mensajeId = mensaje ? "actualizar-contrasena-mensaje" : undefined;

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
            Define una nueva
            <span> contraseña.</span>
          </h1>

          <p>
            Usa una contraseña de al menos 8 caracteres. Al finalizar,
            cerraremos esta sesión de recuperación por seguridad.
          </p>
        </div>

        <section className="auth-card">
          <div className="auth-card-heading">
            <p className="section-label">NUEVA CONTRASEÑA</p>
            <h2>Actualizar acceso</h2>
            <span>
              {tieneSesionRecuperacion || actualizacionCompleta
                ? "Crea tu nueva contraseña para volver a entrar."
                : "El enlace no es válido, expiró o ya fue usado."}
            </span>
          </div>

          {!tieneSesionRecuperacion && !actualizacionCompleta ? (
            <div className="auth-form">
              <p className="auth-message error" role="alert">
                No encontramos una sesión válida de recuperación. Solicita un
                nuevo enlace para proteger tu cuenta.
              </p>

              <button
                className="auth-submit-button"
                type="button"
                onClick={() => navigate("/recuperar-contrasena")}
              >
                Solicitar nuevo enlace
              </button>

              <p className="auth-switch-text">
                ¿Quieres entrar con tu contraseña actual?
                <button type="button" onClick={() => navigate("/auth")}>
                  Ingresar
                </button>
              </p>
            </div>
          ) : (
            <form className="auth-form" onSubmit={manejarEnvio}>
              <label className="auth-field" htmlFor="nueva-contrasena">
                <span>Nueva contraseña</span>

                <div>
                  <LockKeyhole size={18} />
                  <input
                    id="nueva-contrasena"
                    type={mostrarContrasena ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    value={contrasena}
                    onChange={(event) => setContrasena(event.target.value)}
                    autoComplete="new-password"
                    aria-describedby={mensajeId}
                    disabled={cargando || actualizacionCompleta}
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    onClick={() => setMostrarContrasena((visible) => !visible)}
                    aria-label={
                      mostrarContrasena
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                    disabled={cargando || actualizacionCompleta}
                  >
                    {mostrarContrasena ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>

              <label className="auth-field" htmlFor="confirmar-contrasena">
                <span>Confirmar contraseña</span>

                <div>
                  <LockKeyhole size={18} />
                  <input
                    id="confirmar-contrasena"
                    type={mostrarContrasena ? "text" : "password"}
                    placeholder="Repite tu nueva contraseña"
                    value={confirmacion}
                    onChange={(event) => setConfirmacion(event.target.value)}
                    autoComplete="new-password"
                    aria-describedby={mensajeId}
                    disabled={cargando || actualizacionCompleta}
                  />
                </div>
              </label>

              {mensaje && (
                <p
                  id="actualizar-contrasena-mensaje"
                  className={`auth-message ${tipoMensaje}`}
                  role={tipoMensaje === "error" ? "alert" : "status"}
                >
                  {mensaje}
                </p>
              )}

              <button
                className="auth-submit-button"
                type="submit"
                disabled={cargando || actualizacionCompleta}
              >
                {cargando ? "Actualizando..." : "Actualizar contraseña"}
              </button>

              {actualizacionCompleta && (
                <button
                  className="auth-secondary-button"
                  type="button"
                  onClick={() => navigate("/auth")}
                >
                  Volver al login
                </button>
              )}
            </form>
          )}
        </section>
      </section>
    </main>
  );
}

export default ActualizarContrasenaPage;
