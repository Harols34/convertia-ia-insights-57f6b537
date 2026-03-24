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

const queryClient = new QueryClient();

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
              <Route index element={<DashboardPage />} />
              <Route path="dashdinamics" element={<DashDinamicsPage />} />
              <Route path="dashdinamics/detail" element={<ChartDetailPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="reportes" element={<ReportesPage />} />
              <Route path="exportaciones" element={<ExportacionesPage />} />
              <Route path="bots" element={<BotsPage />} />
              <Route path="integraciones" element={<IntegracionesPage />} />
              <Route path="usuarios" element={<UsuariosPage />} />
              <Route path="roles" element={<RolesPage />} />
              <Route path="auditoria" element={<AuditoriaPage />} />
              <Route path="configuracion" element={<ConfiguracionPage />} />
              <Route path="cuentas" element={<CuentasPage />} />
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
