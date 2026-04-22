import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Index from "./pages/Index.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import RecoverPage from "./pages/RecoverPage.tsx";
import AppLayout from "./layouts/AppLayout.tsx";
import DashboardPage from "./pages/app/DashboardPage.tsx";
import DashDinamicsPage from "./pages/app/DashDinamicsPage.tsx";
import ChartDetailPage from "./pages/app/ChartDetailPage.tsx";
import AnalyticsPage from "./pages/app/AnalyticsPage.tsx";
import ReportesPage from "./pages/app/ReportesPage.tsx";
import ExportacionesPage from "./pages/app/ExportacionesPage.tsx";
import BotsPage from "./pages/app/BotsPage.tsx";
import IntegracionesPage from "./pages/app/IntegracionesPage.tsx";
import UsuariosPage from "./pages/app/UsuariosPage.tsx";
import RolesPage from "./pages/app/RolesPage.tsx";
import AuditoriaPage from "./pages/app/AuditoriaPage.tsx";
import ConfiguracionPage from "./pages/app/ConfiguracionPage.tsx";
import SoportePage from "./pages/app/SoportePage.tsx";
import CuentasPage from "./pages/app/CuentasPage.tsx";
import NotFound from "./pages/NotFound.tsx";
import { RequireModule } from "./components/auth/RequireModule.tsx";
import { LeadsDataProvider } from "@/contexts/LeadsDataContext";
import { ArtifactsLoadingBadge } from "@/components/app/ArtifactsLoadingBadge";

const queryClient = new QueryClient();

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
              {/* Sin RequireModule: debe ser alcanzable aunque falte el permiso del módulo (evita bucle Navigate) */}
              <Route path="soporte" element={<SoportePage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
