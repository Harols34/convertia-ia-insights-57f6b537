import { supabase } from "@/integrations/supabase/client";

export async function listAccessibleTenantIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  const { data, error } = await supabase.rpc("get_accessible_tenant_ids", { _user_id: userId });
  if (error) throw error;
  return Array.isArray(data) ? (data as string[]) : [];
}

export async function resolveWritableTenantId(
  userId: string,
  preferredTenantId?: string | null,
): Promise<string | null> {
  const tenantIds = await listAccessibleTenantIds(userId);
  if (preferredTenantId && tenantIds.includes(preferredTenantId)) return preferredTenantId;
  return tenantIds[0] ?? null;
}