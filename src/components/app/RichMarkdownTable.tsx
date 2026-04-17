import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Search, Download } from "lucide-react";
import * as XLSX from "xlsx";

interface RichMarkdownTableProps {
  headers: string[];
  rows: string[][];
}

export function RichMarkdownTable({ headers, rows }: RichMarkdownTableProps) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.some((c) => c.toLowerCase().includes(q)));
  }, [rows, search]);

  const sorted = useMemo(() => {
    if (sortCol === null) return filtered;
    return [...filtered].sort((a, b) => {
      const va = a[sortCol] ?? "";
      const vb = b[sortCol] ?? "";
      const na = parseFloat(va.replace(/[^0-9.,-]/g, "").replace(",", "."));
      const nb = parseFloat(vb.replace(/[^0-9.,-]/g, "").replace(",", "."));
      if (!isNaN(na) && !isNaN(nb)) return sortAsc ? na - nb : nb - na;
      return sortAsc ? va.localeCompare(vb, "es") : vb.localeCompare(va, "es");
    });
  }, [filtered, sortCol, sortAsc]);

  const toggleSort = (i: number) => {
    if (sortCol === i) setSortAsc(!sortAsc);
    else { setSortCol(i); setSortAsc(true); }
  };

  const exportXls = () => {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, "tabla_export.xlsx");
  };

  if (!headers.length) return null;

  return (
    <div className="space-y-2 my-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={exportXls}>
          <Download className="h-3.5 w-3.5" /> Excel
        </Button>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {sorted.length} fila{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              {headers.map((h, i) => (
                <TableHead
                  key={i}
                  className="cursor-pointer select-none text-xs whitespace-nowrap"
                  onClick={() => toggleSort(i)}
                >
                  <span className="inline-flex items-center gap-1">
                    {h}
                    <ArrowUpDown className="h-3 w-3 opacity-40" />
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="text-center text-xs text-muted-foreground py-6">
                  Sin resultados
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((row, ri) => (
                <TableRow key={ri} className="hover:bg-muted/30">
                  {row.map((cell, ci) => (
                    <TableCell key={ci} className="text-xs py-2 px-4">
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
