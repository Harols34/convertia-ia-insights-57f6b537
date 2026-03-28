import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAppAccess } from "@/hooks/use-app-access";
import { moduleSlugForPath } from "@/lib/route-modules";

type Props = {
  children: React.ReactNode;
  /** Si se pasa, tiene prioridad sobre la inferencia por URL */
  moduleSlug?: string | null;
};

/**
 * Bloquea la ruta si el usuario no tiene permiso `view` sobre el módulo (RPC get_my_accessible_module_slugs).
 */
export function RequireModule({ children, moduleSlug }: Props) {
  const location = useLocation();
  const { canAccessModule, isLoading, error } = useAppAccess();

  const slug = moduleSlug ?? moduleSlugForPath(location.pathname);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    // On permission errors, allow access rather than blocking completely
    console.warn("[RequireModule] Permission check error, allowing access:", error);
    return <>{children}</>;
  }

  if (!slug) {
    return <>{children}</>;
  }

  if (!canAccessModule(slug)) {
    return (
      <Navigate
        to="/app/soporte"
        replace
        state={{
          from: location.pathname,
          accessDenied: true,
          module: slug,
        }}
      />
    );
  }

  return <>{children}</>;
}
