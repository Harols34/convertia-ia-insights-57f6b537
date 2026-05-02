import React from "react";
import { format, subDays, startOfMonth, startOfQuarter, startOfYear, endOfDay } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type DateRangePickerProps = {
  desde?: string;
  hasta?: string;
  onChange: (desde: string, hasta: string) => void;
  className?: string;
};

export function DateRangePicker({ desde, hasta, onChange, className }: DateRangePickerProps) {
  const dateRange: DateRange | undefined = React.useMemo(() => {
    if (!desde || !hasta) return undefined;
    return {
      from: new Date(String(desde).slice(0, 10)),
      to: new Date(String(hasta).slice(0, 10)),
    };
  }, [desde, hasta]);

  const handleSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      onChange(format(range.from, "yyyy-MM-dd"), format(range.to, "yyyy-MM-dd"));
    }
  };

  const applyPreset = (preset: "today" | "30d" | "mtd" | "qtd" | "ytd") => {
    const now = new Date();
    let start = now;
    let end = now;

    switch (preset) {
      case "today":
        start = now;
        break;
      case "30d":
        start = subDays(now, 30);
        break;
      case "mtd":
        start = startOfMonth(now);
        break;
      case "qtd":
        start = startOfQuarter(now);
        break;
      case "ytd":
        start = startOfYear(now);
        break;
    }

    onChange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            size="sm"
            className={cn(
              "h-9 justify-start text-left font-normal border-slate-200/60 bg-white/50 backdrop-blur-sm",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-60" />
            <span className="text-[11px] font-medium">
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} -{" "}
                    {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Seleccionar fechas</span>
              )}
            </span>
            <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 flex" align="start">
          <div className="flex flex-col border-r border-border p-2 bg-slate-50/50 min-w-[120px]">
            <span className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1.5 tracking-widest">Atajos</span>
            <Button variant="ghost" size="sm" className="justify-start text-[11px] h-8 font-medium" onClick={() => applyPreset("today")}>Hoy</Button>
            <Button variant="ghost" size="sm" className="justify-start text-[11px] h-8 font-medium" onClick={() => applyPreset("30d")}>Últimos 30 días</Button>
            <Button variant="ghost" size="sm" className="justify-start text-[11px] h-8 font-medium" onClick={() => applyPreset("mtd")}>Mes actual (MTD)</Button>
            <Button variant="ghost" size="sm" className="justify-start text-[11px] h-8 font-medium" onClick={() => applyPreset("qtd")}>Trimestre (QTD)</Button>
            <Button variant="ghost" size="sm" className="justify-start text-[11px] h-8 font-medium" onClick={() => applyPreset("ytd")}>Año actual (YTD)</Button>
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={handleSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
