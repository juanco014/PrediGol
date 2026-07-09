import assert from "node:assert/strict";
import test from "node:test";
import {
  cerrarSesion,
  iniciarSesion,
  obtenerMensajeErrorAuth,
  obtenerPerfilUsuario,
  obtenerSesionActual,
  reclamarPrimerAdmin,
  registrarUsuario,
} from "./userAccountApi.js";

function crearClienteAuthFake({ session = null, authError = null, signUpData = {}, signInData = {} } = {}) {
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
