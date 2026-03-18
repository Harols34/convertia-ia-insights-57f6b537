import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { LogOut, Search, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AppTopbar() {
  const navigate = useNavigate();

  return (
    <header className="h-14 border-b border-border bg-background/80 backdrop-blur-xl flex items-center px-4 gap-3 sticky top-0 z-40">
      <SidebarTrigger />

      <div className="flex-1 flex items-center gap-2 max-w-md">
        <div className="relative flex-1 hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar... (Ctrl+K)"
            className="w-full h-9 pl-9 pr-4 rounded-lg bg-muted border-0 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
        </Button>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/login")}
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
