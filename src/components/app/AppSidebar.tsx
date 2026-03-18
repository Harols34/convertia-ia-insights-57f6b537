import {
  BarChart3, Brain, MessageSquare, FileBarChart, Download,
  Bot, Plug, Users, ShieldCheck, ScrollText, Settings, HelpCircle,
  LayoutDashboard
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import logoImg from "@/assets/logo.ico";

const menuGroups = [
  {
    label: "Análisis",
    items: [
      { title: "Dashboard Ejecutivo", url: "/app", icon: LayoutDashboard },
      { title: "Dashboards con IA", url: "/app/dashboards-ia", icon: Brain },
      { title: "Analytics Conversacional", url: "/app/analytics", icon: MessageSquare },
      { title: "Reportes", url: "/app/reportes", icon: FileBarChart },
      { title: "Exportaciones", url: "/app/exportaciones", icon: Download },
    ],
  },
  {
    label: "Automatización",
    items: [
      { title: "Chatbots / AI Agents", url: "/app/bots", icon: Bot },
      { title: "Integraciones", url: "/app/integraciones", icon: Plug },
    ],
  },
  {
    label: "Gestión",
    items: [
      { title: "Usuarios", url: "/app/usuarios", icon: Users },
      { title: "Roles y Permisos", url: "/app/roles", icon: ShieldCheck },
      { title: "Auditoría y Logs", url: "/app/auditoria", icon: ScrollText },
    ],
  },
  {
    label: "Configuración",
    items: [
      { title: "Configuración", url: "/app/configuracion", icon: Settings },
      { title: "Soporte", url: "/app/soporte", icon: HelpCircle },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`p-4 flex items-center gap-2.5 ${collapsed ? "justify-center px-1" : ""}`}>
          <img src={logoImg} alt="Logo" className={`flex-shrink-0 ${collapsed ? "h-6 w-6" : "h-7 w-7"}`} />
          {!collapsed && <span className="font-display font-bold text-sm truncate">Converti-IA</span>}
        </div>

        {menuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{!collapsed ? group.label : ""}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/app"}
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
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
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
