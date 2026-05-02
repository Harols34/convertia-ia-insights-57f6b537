import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DimensionRow } from "@/lib/dashboard-executive-rpc";
import { Progress } from "@/components/ui/progress";

export function DimensionTable({ 
  data, 
  title, 
  icon: Icon,
  limit = 10 
}: { 
  data: DimensionRow[]; 
  title: string; 
  icon?: any;
  limit?: number;
}) {
  const displayData = data.slice(0, limit);
  const maxLeads = Math.max(...data.map(d => d.leads), 1);

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center gap-2 px-1">
          {Icon && <Icon className="h-4 w-4 text-primary" />}
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</h4>
        </div>
      )}
      <div className="rounded-xl border border-slate-200/60 overflow-hidden bg-white/50">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-bold uppercase tracking-tight py-2 h-9">Dimensión</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-tight py-2 h-9 text-right">Leads</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-tight py-2 h-9 text-right">Ventas</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-tight py-2 h-9 text-right">Conv.</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-tight py-2 h-9 text-right">Contact.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.map((row, i) => (
              <TableRow key={i} className="group hover:bg-slate-100/50 transition-colors">
                <TableCell className="py-2 h-10">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-700 block truncate max-w-[120px]">{row.name}</span>
                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary/40 group-hover:bg-primary transition-all duration-500" 
                        style={{ width: `${(row.leads / maxLeads) * 100}%` }} 
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs font-black py-2 h-10">{row.leads.toLocaleString()}</TableCell>
                <TableCell className="text-right text-xs font-bold text-emerald-600 py-2 h-10">{row.ventas.toLocaleString()}</TableCell>
                <TableCell className="text-right py-2 h-10">
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    row.conv_pct > 10 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {row.conv_pct}%
                  </span>
                </TableCell>
                <TableCell className="text-right py-2 h-10">
                  <span className="text-[10px] font-bold text-slate-500">{row.contactabilidad_pct}%</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
