import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DynamicChart } from "@/components/app/DynamicChart";

export default function ChartDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const chartConfig = (location.state as any)?.chartConfig as Record<string, unknown> | undefined;

  if (!chartConfig) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
        <p className="mb-4">No se encontró configuración de gráfico.</p>
        <Button variant="outline" onClick={() => navigate("/app/dashdinamics")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver al chat
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/app/dashdinamics")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Volver al chat
      </Button>
      <div className="border border-border rounded-xl bg-card p-4">
        <DynamicChart config={chartConfig} allowExpand={false} />
      </div>
    </div>
  );
}
