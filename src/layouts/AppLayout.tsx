import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppTopbar } from "@/components/app/AppTopbar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppDataLoader } from "@/components/dashboard/AppDataLoader";

export default function AppLayout() {
  return (
    <ProtectedRoute>
      <SidebarProvider>
        <div className="flex h-svh max-h-svh min-h-0 w-full overflow-hidden">
          <AppSidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <AppTopbar />
            <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-6">
              <AppDataLoader>
                <Outlet />
              </AppDataLoader>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
