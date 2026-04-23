import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { RequireModule } from "./components/auth/RequireModule.tsx";
import { LeadsDataProvider } from "@/contexts/LeadsDataContext";
import { ArtifactsLoadingBadge } from "@/components/app/ArtifactsLoadingBadge";

const Index = lazy(() => import("./pages/Index.tsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.tsx"));
const RecoverPage = lazy(() => import("./pages/RecoverPage.tsx"));
const AppLayout = lazy(() => import("./layouts/AppLayout.tsx"));
const DashboardPage = lazy(() => import("./pages/app/DashboardPage.tsx"));
const DashDinamicsPage = lazy(() => import("./pages/app/DashDinamicsPage.tsx"));
const ChartDetailPage = lazy(() => import("./pages/app/ChartDetailPage.tsx"));
const AnalyticsPage = lazy(() => import("./pages/app/AnalyticsPage.tsx"));
const ReportesPage = lazy(() => import("./pages/app/ReportesPage.tsx"));
const ExportacionesPage = lazy(() => import("./pages/app/ExportacionesPage.tsx"));
const BotsPage = lazy(() => import("./pages/app/BotsPage.tsx"));
const IntegracionesPage = lazy(() => import("./pages/app/IntegracionesPage.tsx"));
const UsuariosPage = lazy(() => import("./pages/app/UsuariosPage.tsx"));
const RolesPage = lazy(() => import("./pages/app/RolesPage.tsx"));
const AuditoriaPage = lazy(() => import("./pages/app/AuditoriaPage.tsx"));
const ConfiguracionPage = lazy(() => import("./pages/app/ConfiguracionPage.tsx"));
const SoportePage = lazy(() => import("./pages/app/SoportePage.tsx"));
const CuentasPage = lazy(() => import("./pages/app/CuentasPage.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <div className="text-sm text-muted-foreground">Cargando módulo…</div>
  </div>
);

const DashboardRoute = () => (
  <LeadsDataProvider>
    <DashboardPage />
    <ArtifactsLoadingBadge />
  </LeadsDataProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/recuperar" element={<RecoverPage />} />
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<RequireModule moduleSlug="dashboard"><DashboardRoute /></RequireModule>} />
                <Route path="dashdinamics" element={<RequireModule moduleSlug="dashboards-ia"><DashDinamicsPage /></RequireModule>} />
                <Route path="dashdinamics/detail" element={<RequireModule moduleSlug="dashboards-ia"><ChartDetailPage /></RequireModule>} />
                <Route path="analytics" element={<RequireModule moduleSlug="analytics"><AnalyticsPage /></RequireModule>} />
                <Route path="reportes" element={<RequireModule moduleSlug="reportes"><ReportesPage /></RequireModule>} />
                <Route path="exportaciones" element={<RequireModule moduleSlug="exportaciones"><ExportacionesPage /></RequireModule>} />
                <Route path="bots" element={<RequireModule moduleSlug="bots"><BotsPage /></RequireModule>} />
                <Route path="integraciones" element={<RequireModule moduleSlug="integraciones"><IntegracionesPage /></RequireModule>} />
                <Route path="usuarios" element={<RequireModule moduleSlug="usuarios"><UsuariosPage /></RequireModule>} />
                <Route path="roles" element={<RequireModule moduleSlug="roles"><RolesPage /></RequireModule>} />
                <Route path="auditoria" element={<RequireModule moduleSlug="auditoria"><AuditoriaPage /></RequireModule>} />
                <Route path="configuracion" element={<RequireModule moduleSlug="configuracion"><ConfiguracionPage /></RequireModule>} />
                <Route path="cuentas" element={<RequireModule moduleSlug="cuentas"><CuentasPage /></RequireModule>} />
                <Route path="soporte" element={<SoportePage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
