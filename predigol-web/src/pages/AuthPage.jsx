import { useState } from "react";
import { ArrowLeft, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  iniciarSesion,
  obtenerMensajeErrorAuth,
  registrarUsuario,
} from "../services/userAccountApi";

function AuthPage() {
  const navigate = useNavigate();

  const [modo, setModo] = useState("ingresar");
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("");

  const cambiarModo = (nuevoModo) => {
    setModo(nuevoModo);
    setMensaje("");
    setTipoMensaje("");
    setContrasena("");
  };

  const manejarEnvio = async (event) => {
    event.preventDefault();

    setMensaje("");
    setTipoMensaje("");

    const correoLimpio = correo.trim().toLowerCase();

    if (!correoLimpio || !contrasena) {
      setMensaje("Completa tu correo y contraseña.");
      setTipoMensaje("error");
      return;
    }

    if (modo === "registro" && !nombre.trim()) {
      setMensaje("Escribe tu nombre para crear tu perfil.");
      setTipoMensaje("error");
      return;
    }

    if (modo === "registro" && contrasena.length < 8) {
      setMensaje("La contraseña debe tener al menos 8 caracteres.");
      setTipoMensaje("error");
      return;
    }

    try {
      setCargando(true);

      if (modo === "registro") {
        const data = await registrarUsuario({
          correo: correoLimpio,
          contrasena,
          nombre,
          redirectTo: window.location.origin,
        });

        if (data.session) {
          navigate("/inicio");
          return;
        }

        setMensaje(
          "Cuenta creada. Revisa tu correo y confirma tu cuenta para entrar a PrediGol."
        );
        setTipoMensaje("success");
        return;
      }

      await iniciarSesion({ correo: correoLimpio, contrasena });

      navigate("/inicio");
    } catch (error) {
      setMensaje(
        obtenerMensajeErrorAuth(
          error,
          modo === "registro"
            ? "No se pudo crear tu cuenta. Revisa los datos e inténtalo otra vez."
            : "No se pudo iniciar sesión. Revisa tus datos."
        )
      );
      setTipoMensaje("error");
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-intro">
          <button
            className="auth-back-button"
            type="button"
            onClick={() => navigate("/")}
          >
            <ArrowLeft size={18} />
            Volver
          </button>

          <p className="brand">PREDIGOL</p>

          <h1>
            Demuestra que sabes
            <span> de fútbol.</span>
          </h1>

          <p>
            Crea tu cuenta, registra tus pronósticos y compite con hinchas de
            todo el país.
          </p>

          <div className="auth-benefits">
            <span>✓ Pronósticos gratis</span>
            <span>✓ Ligas privadas con amigos</span>
            <span>✓ Ranking y logros</span>
          </div>
        </div>

        <section className="auth-card">
          <div className="auth-tabs">
            <button
              type="button"
              className={modo === "ingresar" ? "auth-tab active" : "auth-tab"}
              onClick={() => cambiarModo("ingresar")}
            >
              Ingresar
            </button>

            <button
              type="button"
              className={modo === "registro" ? "auth-tab active" : "auth-tab"}
              onClick={() => cambiarModo("registro")}
            >
              Crear cuenta
            </button>
          </div>

          <div className="auth-card-heading">
            <p className="section-label">
              {modo === "registro" ? "NUEVO HINCHA" : "BIENVENIDO DE NUEVO"}
            </p>

            <h2>
              {modo === "registro"
                ? "Únete a PrediGol"
                : "Ingresa a tu cuenta"}
            </h2>

            <span>
              {modo === "registro"
                ? "Empieza a competir con tus amigos."
                : "Tus puntos y pronósticos te están esperando."}
            </span>
          </div>

          <form className="auth-form" onSubmit={manejarEnvio}>
            {modo === "registro" && (
              <label className="auth-field">
                <span>Nombre completo</span>

                <div>
                  <UserRound size={18} />
                  <input
                    type="text"
                    placeholder="Ejemplo: Juan Sebastián Arias"
                    value={nombre}
                    onChange={(event) => setNombre(event.target.value)}
                    autoComplete="name"
                  />
                </div>
              </label>
            )}

            <label className="auth-field">
              <span>Correo electrónico</span>

              <div>
                <Mail size={18} />
                <input
                  type="email"
                  placeholder="tucorreo@ejemplo.com"
                  value={correo}
                  onChange={(event) => setCorreo(event.target.value)}
                  autoComplete="email"
                />
              </div>
            </label>

            <label className="auth-field">
              <span>Contraseña</span>

              <div>
                <LockKeyhole size={18} />
                <input
                  type="password"
                  placeholder={
                    modo === "registro"
                      ? "Mínimo 8 caracteres"
                      : "Tu contraseña"
                  }
                  value={contrasena}
                  onChange={(event) => setContrasena(event.target.value)}
                  autoComplete={
                    modo === "registro" ? "new-password" : "current-password"
                  }
                />
              </div>
            </label>

            {mensaje && (
              <p className={`auth-message ${tipoMensaje}`}>{mensaje}</p>
            )}

            <button
              className="auth-submit-button"
              type="submit"
              disabled={cargando}
            >
              {cargando
                ? "Procesando..."
                : modo === "registro"
                  ? "Crear mi cuenta"
                  : "Entrar a PrediGol"}
            </button>
          </form>

          <p className="auth-switch-text">
            {modo === "ingresar" && (
              <button
                className="auth-forgot-button"
                type="button"
                onClick={() => navigate("/recuperar-contrasena")}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}

            {modo === "registro"
              ? "¿Ya tienes una cuenta?"
              : "¿Aún no tienes una cuenta?"}

            <button
              type="button"
              onClick={() =>
                cambiarModo(modo === "registro" ? "ingresar" : "registro")
              }
            >
              {modo === "registro" ? "Ingresar" : "Crear cuenta"}
            </button>
          </p>
        </section>
      </section>
    </main>
  );
}

export default AuthPage;
