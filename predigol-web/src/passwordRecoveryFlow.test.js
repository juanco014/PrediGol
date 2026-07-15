import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function leer(ruta) {
  return readFileSync(new URL(ruta, import.meta.url), "utf8");
}

test("rutas de recuperacion son publicas y rutas privadas conservan proteccion", () => {
  const app = leer("./App.jsx");

  assert.match(app, /path="\/recuperar-contrasena"/);
  assert.match(app, /path="\/actualizar-contrasena"/);
  assert.match(app, /<ProtectedRoute session=\{session\}>\s*<HomePage/s);
  assert.match(app, /<ProtectedRoute session=\{session\}>\s*<ProfilePage/s);
  assert.match(app, /path="\/recuperar-contrasena" element=\{<RecuperarContrasenaPage \/>\}/);
  assert.match(app, /<ActualizarContrasenaPage\s+session=\{session\}\s+recuperacionActiva=\{recuperacionActiva\}/);
});

test("listener global maneja PASSWORD_RECOVERY sin duplicar suscripciones", () => {
  const app = leer("./App.jsx");
  const listeners = app.match(/onAuthStateChange/g) || [];

  assert.equal(listeners.length, 1);
  assert.match(app, /evento === "PASSWORD_RECOVERY"/);
  assert.match(app, /setRecuperacionActiva\(true\)/);
  assert.match(app, /navigate\("\/actualizar-contrasena", \{ replace: true \}\)/);
  assert.match(app, /evento === "SIGNED_OUT"/);
});

test("AuthPage expone enlace secundario de recuperacion solo en ingreso", () => {
  const authPage = leer("./pages/AuthPage.jsx");

  assert.match(authPage, /modo === "ingresar"/);
  assert.match(authPage, /¿Olvidaste tu contraseña\?/);
  assert.match(authPage, /navigate\("\/recuperar-contrasena"\)/);
});

test("formulario de solicitud usa mensaje generico y accesibilidad basica", () => {
  const page = leer("./pages/RecuperarContrasenaPage.jsx");

  assert.match(page, /Si existe una cuenta asociada a ese correo/);
  assert.match(page, /autoComplete="email"/);
  assert.match(page, /aria-describedby=\{mensajeId\}/);
  assert.match(page, /disabled=\{cargando\}/);
  assert.doesNotMatch(page, /correo no existe|usuario no encontrado|no existe una cuenta/i);
});

test("formulario de actualizacion requiere recuperacion valida y limpia campos", () => {
  const page = leer("./pages/ActualizarContrasenaPage.jsx");

  assert.match(page, /session && recuperacionActiva/);
  assert.match(page, /No encontramos una sesión válida de recuperación/);
  assert.match(page, /autoComplete="new-password"/);
  assert.match(page, /limpiarCampos\(\)/);
  assert.match(page, /cerrarSesionRecuperacion\(\)/);
  assert.match(page, /aria-label=/);
});

test("cambios de recuperacion no agregan logs sensibles", () => {
  const archivos = [
    "./App.jsx",
    "./pages/RecuperarContrasenaPage.jsx",
    "./pages/ActualizarContrasenaPage.jsx",
    "./services/userAccountApi.js",
  ];

  for (const archivo of archivos) {
    const contenido = leer(archivo);
    assert.doesNotMatch(contenido, /console\.log|access_token|refresh_token|service_role|localStorage|sessionStorage|innerHTML/);
  }
});
