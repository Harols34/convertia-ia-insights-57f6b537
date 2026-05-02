import { useMemo, useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Lead {
  id: string;
  cliente?: string;
  id_lead?: string;
  campana_mkt?: string;
  bpo?: string;
  result_prim_gestion?: string;
  result_negocio?: string;
  ciudad?: string;
  fch_creacion?: string;
  [key: string]: any;
}

interface LeadsTableProps {
  leads: Lead[];
  pageSize?: number;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  totalCount?: number;
  serverPaginated?: boolean;
  onDelete?: (id: string) => Promise<void>;
}

export function LeadsTable({
  leads,
  pageSize = 15,
  searchValue,
  onSearchChange,
  totalCount,
  serverPaginated = false,
  onDelete,
}: LeadsTableProps) {
  const [internalSearch, setInternalSearch] = useState("");
  const [page, setPage] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const search = searchValue ?? internalSearch;

  const filtered = useMemo(() => {
    if (serverPaginated) return leads;
    return leads.filter((l) =>
      [l.cliente, l.id_lead, l.campana_mkt, l.bpo, l.ciudad, l.result_negocio]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(search.toLowerCase())),
    );
  }, [leads, search, serverPaginated]);

  const totalPages = serverPaginated ? 1 : Math.ceil(filtered.length / pageSize);
  const paged = serverPaginated ? filtered : filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar leads..."
            value={search}
            onChange={(e) => {
              const value = e.target.value;
              if (onSearchChange) onSearchChange(value);
              else setInternalSearch(value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <span className="text-xs text-muted-foreground">{(totalCount ?? filtered.length).toLocaleString("es")} registros</span>
      </div>
      <div className="overflow-auto max-h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>ID Lead</TableHead>
              <TableHead>Campaña MKT</TableHead>
              <TableHead>BPO</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Resultado Gestión</TableHead>
              <TableHead>Resultado Negocio</TableHead>
              <TableHead>Fecha Creación</TableHead>
              {onDelete && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={onDelete ? 9 : 8} className="text-center py-8 text-muted-foreground">
                  No se encontraron registros
                </TableCell>
              </TableRow>
            ) : (
              paged.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.cliente || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{l.id_lead || "—"}</TableCell>
                  <TableCell>{l.campana_mkt || "—"}</TableCell>
                  <TableCell>{l.bpo || "—"}</TableCell>
                  <TableCell>{l.ciudad || "—"}</TableCell>
                  <TableCell>{l.result_prim_gestion || "—"}</TableCell>
                  <TableCell>{l.result_negocio || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {l.fch_creacion ? (
                      (() => {
                        const s = String(l.fch_creacion).trim();
                        // Limpiar formato fecha:hora si existe
                        const cleanS = s.includes(":") && s.indexOf(":") === 10 
                          ? s.slice(0, 10) + " " + s.slice(11)
                          : s;
                        const d = new Date(cleanS);
                        return isNaN(d.getTime()) ? (s.slice(0, 10)) : d.toLocaleDateString("es");
                      })()
                    ) : "—"}
                  </TableCell>
                  {onDelete && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-50"
                        onClick={() => setDeleteId(l.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {!serverPaginated && totalPages > 1 && (
        <div className="p-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="glass-bi border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-black text-foreground">¿Eliminar registro?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-medium leading-relaxed">
              Esta acción realizará un borrado lógico del lead. No se mostrará en la actividad reciente pero se mantendrá en los históricos agregados para no corromper las métricas BI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="font-bold uppercase tracking-wider text-[10px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteId || !onDelete) return;
                setDeleting(true);
                try {
                  await onDelete(deleteId);
                  setDeleteId(null);
                } finally {
                  setDeleting(false);
                }
              }}
              className="bg-rose-500 hover:bg-rose-600 text-white font-bold uppercase tracking-wider text-[10px]"
            >
              {deleting ? "Eliminando..." : "Confirmar Borrado"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
