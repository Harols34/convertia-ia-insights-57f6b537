import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, UserPlus, Trash2, Shield, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

interface BoardShareDialogProps {
  boardId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
}

export function BoardShareDialog({ boardId, isOpen, onOpenChange, ownerId }: BoardShareDialogProps) {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const isOwner = currentUser?.id === ownerId;

  const { data: shares = [], isLoading: loadingShares } = useQuery({
    queryKey: ["board-shares", boardId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("analytics_board_shares")
        .select("id, user_id, access_level")
        .eq("board_id", boardId);
      if (error) throw error;
      const userIds = (rows ?? []).map((r) => r.user_id).filter(Boolean) as string[];
      let profilesById = new Map<string, { id: string; full_name: string | null; avatar_url: string | null; tenant_name: string | null }>();
      if (userIds.length) {
        // RPC global (SECURITY DEFINER) para resolver perfiles de cualquier tenant
        const { data: profs, error: pErr } = await supabase
          .rpc("get_profiles_by_ids", { user_ids: userIds });
        if (pErr) throw pErr;
        profilesById = new Map((profs ?? []).map((p: any) => [p.id, p]));
      }
      return (rows ?? []).map((r) => ({
        ...r,
        profiles: r.user_id ? profilesById.get(r.user_id) ?? null : null,
      }));
    },
    enabled: isOpen
  });

  const { data: availableUsers = [] } = useQuery({
    queryKey: ["available-users-for-share", search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      // RPC global para buscar usuarios de TODOS los tenants
      const { data, error } = await supabase
        .rpc("search_shareable_users", { search_term: search });
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && search.length >= 2
  });

  const addShare = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("analytics_board_shares")
        .insert({
          board_id: boardId,
          user_id: userId,
          access_level: 'edit'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-shares", boardId] });
      setSearch("");
      toast.success("Usuario añadido al tablero");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al compartir");
    }
  });

  const removeShare = useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase
        .from("analytics_board_shares")
        .delete()
        .eq("id", shareId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-shares", boardId] });
      toast.success("Acceso revocado");
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Compartir Tablero
          </DialogTitle>
          <DialogDescription>
            Invita a otros usuarios para trabajar de forma colaborativa en este tablero.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {isOwner && (
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Invitar colaboradores</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  placeholder="Buscar por nombre..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-11"
                />
              </div>

              {availableUsers.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/30 overflow-hidden divide-y divide-border">
                  {availableUsers.map((u: any) => {
                    const isAlreadyShared = shares.some(s => s.user_id === u.id);
                    return (
                      <div key={u.id} className="flex items-center justify-between p-3 hover:bg-background/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-border">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{u.full_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{u.full_name}</span>
                            <span className="text-[10px] text-muted-foreground">{u.tenant_name ?? "Sin cuenta"}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isAlreadyShared ? "ghost" : "default"}
                          disabled={isAlreadyShared || addShare.isPending}
                          onClick={() => addShare.mutate(u.id)}
                          className="h-8 text-xs gap-1.5"
                        >
                          {addShare.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                          {isAlreadyShared ? "Compartido" : "Añadir"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Usuarios con acceso</Label>
            <div className="space-y-2">
              {/* Owner always shown */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">Propietario</span>
                    <span className="text-[10px] text-muted-foreground">Control total del tablero</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase text-primary px-2 py-1 rounded-full bg-primary/10">Admin</span>
              </div>

              {loadingShares ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                shares.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-[10px]">{s.profiles?.full_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{s.profiles?.full_name ?? "Usuario"}</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          {s.profiles?.tenant_name ?? "Editor colaborativo"}
                        </span>
                      </div>
                    </div>
                    {isOwner && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeShare.mutate(s.id)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
