export function isAdminUser(profile) {
  return profile?.rol === "admin" || Boolean(profile?.es_admin);
}
