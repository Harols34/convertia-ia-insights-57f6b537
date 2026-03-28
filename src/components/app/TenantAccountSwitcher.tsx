import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function TenantAccountSwitcher() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tenantIds, isLoading: loadingIds } = useQuery({
    queryKey: ["accessible-tenant-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_accessible_tenant_ids", { _user_id: user!.id });
      if (error) throw error;
      return (data as string[]) || [];
    },
  });

  const { data: tenants } = useQuery({
    queryKey: ["tenant-names", tenantIds],
    enabled: !!tenantIds && tenantIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("id, name, slug").in("id", tenantIds!);
      if (error) throw error;
      const list = data || [];
      const order = new Map(tenantIds!.map((id, i) => [id, i]));
      return [...list].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    },
  });

  const { data: currentTenantId } = useQuery({
    queryKey: ["current-session-tenant", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_tenant", { _user_id: user!.id });
      if (error) throw error;
      return data as string;
    },
  });

  const switchTenant = useMutation({
    mutationFn: async (tid: string | null) => {
      const { error } = await supabase.rpc("set_active_tenant", { _tenant_id: tid });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Cuenta activa actualizada");
      window.location.reload();
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo cambiar de cuenta"),
  });

  if (!user || loadingIds || !tenantIds || tenantIds.length <= 1) {
    return null;
  }

  const current = tenants?.find((t) => t.id === currentTenantId);
  const label = current?.name || "Cuenta";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 max-w-[200px] gap-2 border-dashed">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate text-xs">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Trabajar en cuenta</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tenants?.map((t) => (
          <DropdownMenuItem
            key={t.id}
            className="gap-2 text-sm"
            onClick={() => {
              if (t.id !== currentTenantId) switchTenant.mutate(t.id);
            }}
          >
            {t.id === currentTenantId ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <span className="w-4 shrink-0" />}
            <span className="truncate">{t.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-xs text-muted-foreground"
          disabled={switchTenant.isPending}
          onClick={() => switchTenant.mutate(null)}
        >
          {switchTenant.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
          Volver a cuenta principal (perfil)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
