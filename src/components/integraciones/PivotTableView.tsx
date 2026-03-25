import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PivotGridResult, PivotMeasureSpec } from "@/lib/pivot-engine";
import { formatPivotLabel, PIVOT_KEY_SEP } from "@/lib/pivot-engine";

function parseKey(k: string): string[] {
  return k.split(PIVOT_KEY_SEP);
}

export function fmtPivotNum(n: number | undefined) {
  if (n === undefined) return "—";
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString("es", { maximumFractionDigits: 4 });
}

export function PivotTableView({
  grid,
  measures,
  onRowClick,
  rowOpacity,
}: {
  grid: PivotGridResult;
  measures: PivotMeasureSpec[];
  /** Clic en la fila (filtros cruzados en el tablero) */
  onRowClick?: (rowKey: string) => void;
  /** Opacidad por fila (p. ej. atenuar valores no seleccionados en filtros cruzados) */
  rowOpacity?: (rowKey: string) => number;
}) {
  const { rowKeys, colKeys, cells, rowLabels, colLabels } = grid;
  const multiM = measures.length > 1;

  return (
    <Table>
      <TableHeader>
        {multiM ? (
          <>
            <TableRow>
              <TableHead className="w-[120px] sticky left-0 bg-card z-10">Filas</TableHead>
              {colKeys.map((ck) => (
                <TableHead key={ck} colSpan={measures.length} className="text-center border-l text-xs">
                  {formatPivotLabel(colLabels.get(ck) ?? parseKey(ck))}
                </TableHead>
              ))}
            </TableRow>
            <TableRow>
              <TableHead className="sticky left-0 bg-card z-10" />
              {colKeys.flatMap((ck) =>
                measures.map((m) => (
                  <TableHead key={`${ck}-${m.id}`} className="text-[10px] border-l whitespace-nowrap max-w-[88px] truncate">
                    {m.kind === "field" ? `${m.field}` : m.label}
                  </TableHead>
                )),
              )}
            </TableRow>
          </>
        ) : (
          <TableRow>
            <TableHead className="w-[120px] sticky left-0 bg-card z-10">Filas</TableHead>
            {colKeys.map((ck) => (
              <TableHead key={ck} className="text-xs border-l">
                {formatPivotLabel(colLabels.get(ck) ?? parseKey(ck))}
              </TableHead>
            ))}
          </TableRow>
        )}
      </TableHeader>
      <TableBody>
        {rowKeys.map((rk) => (
          <TableRow
            key={rk}
            className={onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined}
            style={rowOpacity ? { opacity: rowOpacity(rk) } : undefined}
            onClick={onRowClick ? () => onRowClick(rk) : undefined}
          >
            <TableCell className="text-xs sticky left-0 bg-card z-10 font-medium">
              {formatPivotLabel(rowLabels.get(rk) ?? parseKey(rk))}
            </TableCell>
            {multiM
              ? colKeys.flatMap((ck) =>
                  measures.map((m) => (
                    <TableCell key={`${rk}-${ck}-${m.id}`} className="text-xs border-l tabular-nums text-right">
                      {fmtPivotNum(cells.get(rk)?.get(ck)?.get(m.id))}
                    </TableCell>
                  )),
                )
              : colKeys.map((ck) => (
                  <TableCell key={`${rk}-${ck}`} className="text-xs border-l tabular-nums text-right">
                    {fmtPivotNum(cells.get(rk)?.get(ck)?.get(measures[0]?.id))}
                  </TableCell>
                ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
