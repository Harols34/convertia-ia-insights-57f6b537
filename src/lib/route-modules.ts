/** Slug en `public.modules.slug` asociado a rutas bajo /app */
export const ROUTE_PREFIX_TO_MODULE: Record<string, string> = {
  "/app": "dashboard",
  "/app/dashdinamics": "dashboards-ia",
  "/app/dashdinamics/detail": "dashboards-ia",
  "/app/analytics": "analytics",
  "/app/reportes": "reportes",
  "/app/exportaciones": "exportaciones",
  "/app/bots": "bots",
  "/app/telegram": "telegram",
  "/app/integraciones": "integraciones",
  "/app/usuarios": "usuarios",
  "/app/roles": "roles",
  "/app/auditoria": "auditoria",
  "/app/configuracion": "configuracion",
  "/app/cuentas": "cuentas",
  "/app/soporte": "soporte",
};

export function moduleSlugForPath(pathname: string): string | null {
  if (pathname === "/app" || pathname === "/app/") return "dashboard";
  const entries = Object.entries(ROUTE_PREFIX_TO_MODULE).sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, slug] of entries) {
    if (prefix === "/app") continue;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return slug;
  }
  return null;
}
