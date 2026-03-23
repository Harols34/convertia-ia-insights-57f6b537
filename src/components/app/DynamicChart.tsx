import ReactECharts from "echarts-for-react";
import { Expand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface DynamicChartProps {
  config: Record<string, unknown>;
  allowExpand?: boolean;
  height?: number;
}

export function DynamicChart({ config, allowExpand = true, height = 280 }: DynamicChartProps) {
  const navigate = useNavigate();

  const option = {
    ...config,
    backgroundColor: "transparent",
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true, ...(config.grid as object || {}) },
  };

  return (
    <div className="relative rounded-lg border border-border bg-card p-2 mt-2">
      {allowExpand && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-10 h-7 w-7"
          onClick={() => navigate("/app/dashdinamics/detail", { state: { chartConfig: config } })}
        >
          <Expand className="h-3.5 w-3.5" />
        </Button>
      )}
      <ReactECharts option={option} style={{ height, width: "100%" }} notMerge lazyUpdate />
    </div>
  );
}
