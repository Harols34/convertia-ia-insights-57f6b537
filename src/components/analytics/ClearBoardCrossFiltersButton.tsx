import { Button } from "@/components/ui/button";
import { useBoardCrossFilter } from "@/contexts/BoardCrossFilterContext";
import { countCrossSliceSelections } from "@/lib/board-cross-filter";

export function ClearBoardCrossFiltersButton() {
  const { clearAllSlices, slices } = useBoardCrossFilter();
  const n = countCrossSliceSelections(slices);
  if (n === 0) return null;
  return (
    <Button type="button" size="sm" variant="secondary" className="h-9 text-xs" onClick={clearAllSlices}>
      Quitar filtros ({n})
    </Button>
  );
}
