import assert from "node:assert/strict";
import test from "node:test";
import {
  actualizarContrasena,
  cerrarSesion,
  cerrarSesionRecuperacion,
  correoTieneFormatoValido,
  iniciarSesion,
  obtenerMensajeErrorAuth,
  obtenerPlanUsuario,
  obtenerPerfilUsuario,
  obtenerSesionActual,
  reclamarPrimerAdmin,
  registrarUsuario,
  solicitarRecuperacionContrasena,
  validarNuevaContrasena,
} from "./userAccountApi.js";

function crearClienteAuthFake({
  session = null,
  authError = null,
  signUpData = {},
  signInData = {},
  resetData = {},
  updateData = {},
} = {}) {
  const calls = [];

  return {
    calls,
    auth: {
      getSession() {
        calls.push(["getSession"]);
        return Promise.resolve({ data: { session }, error: authError });
      },
      signUp(payload) {
        calls.push(["signUp", payload]);
        return Promise.resolve({ data: signUpData, error: authError });
      },
      signInWithPassword(payload) {
        calls.push(["signInWithPassword", payload]);
        return Promise.resolve({ data: signInData, error: authError });
      },
      signOut() {
        calls.push(["signOut"]);
        return Promise.resolve({ error: authError });
      },
      resetPasswordForEmail(email, options) {
        calls.push(["resetPasswordForEmail", email, options]);
        return Promise.resolve({ data: resetData, error: authError });
      },
      updateUser(payload) {
        calls.push(["updateUser", payload]);
        return Promise.resolve({ data: updateData, error: authError });
      },
    },
  };
}

function crearClientePerfilFake({ profile = null, profileError = null, rpcData = true, rpcError = null } = {}) {
  const calls = [];

  return {
    calls,
    from(table) {
      calls.push(["from", table]);
      return {
        select(columns) {
          calls.push(["select", columns]);
          return this;
        },
        eq(field, value) {
          calls.push(["eq", field, value]);
          return this;
        },
        maybeSingle() {
          calls.push(["maybeSingle"]);
          return Promise.resolve({ data: profile, error: profileError });
        },
      };
    },
    rpc(name) {
      calls.push(["rpc", name]);
      return Promise.resolve({ data: rpcData, error: rpcError });
    },
  };
}

test("obtenerMensajeErrorAuth traduce errores comunes", () => {
  assert.equal(
    obtenerMensajeErrorAuth(new Error("Invalid login credentials")),
    "No se pudo iniciar sesión. Revisa tus datos."
  );
  assert.equal(
    obtenerMensajeErrorAuth(new Error("permission denied for table profiles")),
    "No tienes permisos para realizar esta acción."
  );
  assert.equal(
    obtenerMensajeErrorAuth(null, "Mensaje fallback"),
    "Mensaje fallback"
  );
  assert.equal(
    obtenerMensajeErrorAuth(new Error("rate limit exceeded")),
    "Hay demasiados intentos por ahora. Espera unos minutos e inténtalo de nuevo."
  );
  assert.equal(
    obtenerMensajeErrorAuth(new Error("token has expired")),
    "El enlace expiró. Solicita un nuevo correo de recuperación."
  );
  assert.equal(
    obtenerMensajeErrorAuth(new Error("invalid token")),
    "El enlace no es válido o ya fue usado. Solicita un nuevo correo de recuperación."
  );
});

test("validaciones de recuperacion no revelan existencia de cuenta", () => {
  assert.equal(correoTieneFormatoValido("usuario@predigol.test"), true);
  assert.equal(correoTieneFormatoValido("usuario"), false);
  assert.equal(
    obtenerMensajeErrorAuth(
      new Error("User not found"),
      "Si existe una cuenta asociada a ese correo, recibirás instrucciones para restablecer tu contraseña."
    ),
    "Si existe una cuenta asociada a ese correo, recibirás instrucciones para restablecer tu contraseña."
  );
});

test("validarNuevaContrasena aplica politica minima consistente", () => {
  assert.equal(
    validarNuevaContrasena("", ""),
    "Completa la nueva contraseña y su confirmación."
  );
  assert.equal(
    validarNuevaContrasena("short", "short"),
    "La contraseña debe tener al menos 8 caracteres."
  );
  assert.equal(
    validarNuevaContrasena("password123", "password456"),
    "Las contraseñas no coinciden."
  );
  assert.equal(validarNuevaContrasena("password123", "password123"), "");
});

test("obtenerSesionActual devuelve null sin sesion", async () => {
  const client = crearClienteAuthFake({ session: null });

  const result = await obtenerSesionActual(client);

  assert.equal(result, null);
  assert.deepEqual(client.calls[0], ["getSession"]);
});

test("registrarUsuario normaliza payload y devuelve respuesta exitosa", async () => {
  const client = crearClienteAuthFake({ signUpData: { session: { user: { id: "u1" } } } });

  const result = await registrarUsuario(
    {
      correo: " TEST@MAIL.COM ",
      contrasena: "password123",
      nombre: " Ana PrediGol ",
      redirectTo: "https://predigol.test",
    },
    client
  );

  assert.equal(result.session.user.id, "u1");
  assert.equal(client.calls[0][1].email, "test@mail.com");
  assert.equal(client.calls[0][1].options.data.nombre, "Ana PrediGol");
  assert.equal(client.calls[0][1].options.emailRedirectTo, "https://predigol.test");
});

test("iniciarSesion usa credenciales normalizadas", async () => {
  const client = crearClienteAuthFake({ signInData: { user: { id: "u1" } } });

  const result = await iniciarSesion(
    { correo: " USER@MAIL.COM ", contrasena: "password123" },
    client
  );

  assert.equal(result.user.id, "u1");
  assert.equal(client.calls[0][1].email, "user@mail.com");
});

test("cerrarSesion devuelve true ante respuesta exitosa", async () => {
  const client = crearClienteAuthFake();

  assert.equal(await cerrarSesion(client), true);
  assert.deepEqual(client.calls[0], ["signOut"]);
});

test("obtenerPerfilUsuario soporta perfil vacio", async () => {
  const client = crearClientePerfilFake({ profile: null });

  const result = await obtenerPerfilUsuario("u1", client);

  assert.equal(result, null);
  assert.deepEqual(client.calls[0], ["from", "profiles"]);
  assert.deepEqual(client.calls[2], ["eq", "id", "u1"]);
});

test("obtenerPerfilUsuario conserva datos de perfil", async () => {
  const client = crearClientePerfilFake({
    profile: { id: "u1", nombre: "Ana", username: "ana", es_admin: true },
  });

  const result = await obtenerPerfilUsuario("u1", client);

  assert.equal(result.id, "u1");
  assert.equal(result.nombre, "Ana");
  assert.equal(result.es_admin, true);
});

test("obtenerPerfilUsuario propaga error de permisos", async () => {
  const client = crearClientePerfilFake({
    profileError: new Error("permission denied for table profiles"),
  });

  await assert.rejects(() => obtenerPerfilUsuario("u1", client), /permission denied/);
});

test("reclamarPrimerAdmin usa RPC existente", async () => {
  const client = crearClientePerfilFake({ rpcData: { ok: true } });

  const result = await reclamarPrimerAdmin(client);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(client.calls[0], ["rpc", "reclamar_primer_admin"]);
});

test("solicitarRecuperacionContrasena usa redirectTo seguro y correo normalizado", async () => {
  const client = crearClienteAuthFake({ resetData: { ok: true } });
  const windowOriginal = globalThis.window;

  globalThis.window = { location: { origin: "https://predigol.test" } };

  try {
    const result = await solicitarRecuperacionContrasena({ correo: " USER@MAIL.COM " }, client);

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(client.calls[0], [
      "resetPasswordForEmail",
      "user@mail.com",
      { redirectTo: "https://predigol.test/actualizar-contrasena" },
    ]);
  } finally {
    globalThis.window = windowOriginal;
  }
});

test("solicitarRecuperacionContrasena valida correo antes de llamar Supabase", async () => {
  const client = crearClienteAuthFake();

  await assert.rejects(
    () => solicitarRecuperacionContrasena({ correo: "correo-invalido" }, client),
    /correo electrónico válido/
  );

  assert.equal(client.calls.length, 0);
});

test("actualizarContrasena usa updateUser sin persistir contraseña", async () => {
  const client = crearClienteAuthFake({ updateData: { user: { id: "u1" } } });

  const result = await actualizarContrasena({ contrasena: "password123" }, client);

  assert.equal(result.user.id, "u1");
  assert.deepEqual(client.calls[0], ["updateUser", { password: "password123" }]);
});

test("actualizarContrasena valida longitud antes de llamar Supabase", async () => {
  const client = crearClienteAuthFake();

  await assert.rejects(
    () => actualizarContrasena({ contrasena: "short" }, client),
    /al menos 8 caracteres/
  );

  assert.equal(client.calls.length, 0);
});

test("cerrarSesionRecuperacion finaliza sesion de auth", async () => {
  const client = crearClienteAuthFake();

  assert.equal(await cerrarSesionRecuperacion(client), true);
  assert.deepEqual(client.calls[0], ["signOut"]);
});

test("obtenerPlanUsuario normaliza plan gratuito y premium", async () => {
  const freeClient = crearClientePerfilFake({ rpcData: null });
  const premiumClient = crearClientePerfilFake({
    rpcData: {
      plan_code: "premium",
      status: "premium_active",
      is_premium: true,
      expires_at: "2026-12-31T00:00:00Z",
      source: "user_subscriptions",
    },
  });

  const free = await obtenerPlanUsuario(freeClient);
  const premium = await obtenerPlanUsuario(premiumClient);

  assert.equal(free.planCode, "free");
  assert.equal(free.isPremium, false);
  assert.equal(premium.planCode, "premium");
  assert.equal(premium.isPremium, true);
  assert.deepEqual(premiumClient.calls[0], ["rpc", "obtener_plan_usuario"]);
});
