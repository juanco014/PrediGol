import { supabase } from "../lib/supabase.js";

async function obtenerClienteSupabase(client) {
  return client || supabase;
}

export function obtenerMensajeErrorAuth(error, fallback = "No fue posible continuar. Inténtalo nuevamente.") {
  const mensaje = String(error?.message || "").toLowerCase();

  if (!mensaje) return fallback;

  if (mensaje.includes("invalid login") || mensaje.includes("invalid credentials")) {
    return "No se pudo iniciar sesión. Revisa tus datos.";
  }

  if (mensaje.includes("email not confirmed")) {
    return "Confirma tu correo antes de iniciar sesión.";
  }

  if (mensaje.includes("already registered") || mensaje.includes("already exists")) {
    return "Ya existe una cuenta con este correo.";
  }

  if (
    mensaje.includes("permission") ||
    mensaje.includes("not authorized") ||
    mensaje.includes("denied") ||
    mensaje.includes("rls") ||
    mensaje.includes("policy")
  ) {
    return "No tienes permisos para realizar esta acción.";
  }

  if (mensaje.includes("network") || mensaje.includes("fetch")) {
    return "No pudimos conectar con PrediGol. Revisa tu conexión e inténtalo de nuevo.";
  }

  return fallback;
}

export async function obtenerSesionActual(client = null) {
  const db = await obtenerClienteSupabase(client);
  const { data, error } = await db.auth.getSession();

  if (error) throw error;

  return data?.session || null;
}

export async function registrarUsuario({ correo, contrasena, nombre, redirectTo }, client = null) {
  const correoLimpio = String(correo || "").trim().toLowerCase();
  const nombreLimpio = String(nombre || "").trim();

  if (!correoLimpio || !contrasena) {
    throw new Error("Completa tu correo y contraseña.");
  }

  if (!nombreLimpio) {
    throw new Error("Escribe tu nombre para crear tu perfil.");
  }

  if (String(contrasena).length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  const db = await obtenerClienteSupabase(client);
  const { data, error } = await db.auth.signUp({
    email: correoLimpio,
    password: contrasena,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        nombre: nombreLimpio,
      },
    },
  });

  if (error) throw error;

  return data;
}

export async function iniciarSesion({ correo, contrasena }, client = null) {
  const correoLimpio = String(correo || "").trim().toLowerCase();

  if (!correoLimpio || !contrasena) {
    throw new Error("Completa tu correo y contraseña.");
  }

  const db = await obtenerClienteSupabase(client);
  const { data, error } = await db.auth.signInWithPassword({
    email: correoLimpio,
    password: contrasena,
  });

  if (error) throw error;

  return data;
}

export async function cerrarSesion(client = null) {
  const db = await obtenerClienteSupabase(client);
  const { error } = await db.auth.signOut();

  if (error) throw error;

  return true;
}

export async function obtenerPerfilUsuario(usuarioId, client = null) {
  if (!usuarioId) return null;

  const db = await obtenerClienteSupabase(client);
  const { data, error } = await db
    .from("profiles")
    .select("id, nombre, username, avatar_url, es_admin, rol")
    .eq("id", usuarioId)
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

export async function obtenerPlanUsuario(client = null) {
  const db = await obtenerClienteSupabase(client);
  const { data, error } = await db.rpc("obtener_plan_usuario");

  if (error) throw error;

  return {
    planCode: data?.plan_code || "free",
    status: data?.status || "free",
    isPremium: Boolean(data?.is_premium),
    expiresAt: data?.expires_at || null,
    source: data?.source || "default_free",
  };
}

export async function reclamarPrimerAdmin(client = null) {
  const db = await obtenerClienteSupabase(client);
  const { data, error } = await db.rpc("reclamar_primer_admin");

  if (error) throw error;

  return data ?? true;
}
