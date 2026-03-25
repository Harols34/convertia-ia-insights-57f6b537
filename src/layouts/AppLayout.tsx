import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppTopbar } from "@/components/app/AppTopbar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LeadsDataProvider } from "@/contexts/LeadsDataContext";
import { ArtifactsLoadingBadge } from "@/components/app/ArtifactsLoadingBadge";

export default function AppLayout() {
  return (
    <ProtectedRoute>
      <LeadsDataProvider>
        <SidebarProvider>
          <div className="min-h-screen flex w-full">
            <AppSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <AppTopbar />
              <main className="flex-1 p-6">
                <Outlet />
              </main>
            </div>
          </div>
          <ArtifactsLoadingBadge />
        </SidebarProvider>
      </LeadsDataProvider>
    </ProtectedRoute>
  );
}
