/**
 * Misma forma de carga perezosa que en `App.tsx`, para precargar el chunk bajo demanda
 * (p. ej. al pasar el cursor por el menú) y suavizar el cambio de módulo.
 */
export function prefetchAppRouteByPath(path: string) {
  switch (path) {
    case "/app":
      return void import("@/pages/app/DashboardPage");
    case "/app/dashdinamics":
      return void import("@/pages/app/DashDinamicsPage");
    case "/app/dashdinamics/detail":
      return void import("@/pages/app/ChartDetailPage");
    case "/app/analytics":
      return void import("@/pages/app/AnalyticsPage");
    case "/app/reportes":
      return void import("@/pages/app/ReportesPage");
    case "/app/exportaciones":
      return void import("@/pages/app/ExportacionesPage");
    case "/app/bots":
      return void import("@/pages/app/BotsPage");
    case "/app/integraciones":
      return void import("@/pages/app/IntegracionesPage");
    case "/app/cuentas":
      return void import("@/pages/app/CuentasPage");
    case "/app/usuarios":
      return void import("@/pages/app/UsuariosPage");
    case "/app/roles":
      return void import("@/pages/app/RolesPage");
    case "/app/auditoria":
      return void import("@/pages/app/AuditoriaPage");
    case "/app/configuracion":
      return void import("@/pages/app/ConfiguracionPage");
    case "/app/soporte":
      return void import("@/pages/app/SoportePage");
    default:
      return;
  }
}
