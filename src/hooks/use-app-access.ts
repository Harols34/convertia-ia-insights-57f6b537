import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function useAppAccess() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const superQ = useQuery({
    queryKey: ["is-super-admin", user?.id],
    enabled: !!user,
    retry: 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: user!.id, _role: "super_admin" });
      if (error) {
        console.warn("[useAppAccess] has_role error:", error.message);
        throw error;
      }
      return !!data;
    },
  });

  const q = useQuery({
    queryKey: ["accessible-module-slugs", user?.id],
    enabled: !!user,
    retry: 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_accessible_module_slugs");
      if (error) {
        console.warn("[useAppAccess] get_my_accessible_module_slugs error:", error.message);
        throw error;
      }
      return (data as string[]) || [];
    },
  });

  const canAccessModule = (slug: string | null | undefined) => {
    if (!slug) return true;
    // Always allow soporte (landing page for denied access)
    if (slug === "soporte") return true;
    // Super admin bypasses all restrictions
    if (superQ.data === true) return true;
    // If queries haven't loaded yet, don't block (loading state handled by isLoading)
    if (q.data === undefined && superQ.data === undefined) return true;
    return (q.data ?? []).includes(slug);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["accessible-module-slugs"] });
    queryClient.invalidateQueries({ queryKey: ["is-super-admin"] });
  };

  return {
    moduleSlugs: q.data ?? [],
    canAccessModule,
    isLoading: q.isLoading || superQ.isLoading,
    error: q.error ?? superQ.error,
    isSuperAdmin: superQ.data === true,
    refetch: () => Promise.all([q.refetch(), superQ.refetch()]).then(() => undefined),
    invalidate,
  };
}

export function useIsSuperAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-super-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: user!.id, _role: "super_admin" });
      if (error) throw error;
      return !!data;
    },
  });
}
