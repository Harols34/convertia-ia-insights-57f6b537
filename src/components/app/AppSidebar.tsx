import {
  MessageSquare, FileBarChart, Download,
  Bot, Plug, Users, ShieldCheck, ScrollText, Settings, HelpCircle,
  LayoutDashboard, Building2, Sparkles, SlidersHorizontal,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAppAccess } from "@/hooks/use-app-access";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import logoImg from "@/assets/logo.ico";
import { prefetchAppRouteByPath } from "@/lib/app-route-prefetch";

type MenuItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  moduleSlug: string;
};

const menuGroups: { label: string; items: MenuItem[] }[] = [
  {
    label: "Análisis",
    items: [
      { title: "Dashboard", url: "/app", icon: LayoutDashboard, moduleSlug: "dashboard" },
      { title: "Dashboard IA", url: "/app/dashdinamics", icon: Sparkles, moduleSlug: "dashboards-ia" },
      { title: "Dashboard Dinámicos", url: "/app/analytics", icon: SlidersHorizontal, moduleSlug: "analytics" },
      { title: "Reportes", url: "/app/reportes", icon: FileBarChart, moduleSlug: "reportes" },
      { title: "Exportaciones", url: "/app/exportaciones", icon: Download, moduleSlug: "exportaciones" },
    ],
  },
  {
    label: "Automatización",
    items: [
      { title: "Chatbots / AI Agents", url: "/app/bots", icon: Bot, moduleSlug: "bots" },
      { title: "Integraciones", url: "/app/integraciones", icon: Plug, moduleSlug: "integraciones" },
    ],
  },
  {
    label: "Gestión",
    items: [
      { title: "Cuentas (Tenants)", url: "/app/cuentas", icon: Building2, moduleSlug: "cuentas" },
      { title: "Usuarios", url: "/app/usuarios", icon: Users, moduleSlug: "usuarios" },
      { title: "Roles y Permisos", url: "/app/roles", icon: ShieldCheck, moduleSlug: "roles" },
      { title: "Auditoría y Logs", url: "/app/auditoria", icon: ScrollText, moduleSlug: "auditoria" },
    ],
  },
  {
    label: "Configuración",
    items: [
      { title: "Configuración", url: "/app/configuracion", icon: Settings, moduleSlug: "configuracion" },
      { title: "Soporte", url: "/app/soporte", icon: HelpCircle, moduleSlug: "soporte" },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { canAccessModule, isLoading: accessLoading } = useAppAccess();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`p-4 flex items-center gap-2.5 ${collapsed ? "justify-center px-1" : ""}`}>
          <img src={logoImg} alt="Logo" className={`flex-shrink-0 ${collapsed ? "h-6 w-6" : "h-7 w-7"}`} />
          {!collapsed && <span className="font-display font-bold text-sm truncate">Converti-IA</span>}
        </div>

        {menuGroups.map((group) => {
          const visible = group.items.filter((item) => accessLoading || canAccessModule(item.moduleSlug));
          if (visible.length === 0) return null;
          return (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{!collapsed ? group.label : ""}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visible.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/app"}
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        onMouseEnter={() => prefetchAppRouteByPath(item.url)}
                        onFocus={() => prefetchAppRouteByPath(item.url)}
                      >
                        <item.icon className="mr-2 h-4 w-4 flex-shrink-0" />
                        {!collapsed && <span className="truncate">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
