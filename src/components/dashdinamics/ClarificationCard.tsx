import { useState } from "react";
import { ClarifyingQuestion } from "@/types/dashdinamics";
import { Button } from "@/components/ui/button";
import { HelpCircle, Send, Check } from "lucide-react";

interface ClarificationCardProps {
  message: string;
  questions: ClarifyingQuestion[];
  onAnswer: (answer: string) => void;
}

export function ClarificationCard({ message, questions, onAnswer }: ClarificationCardProps) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  const toggleOption = (questionId: string, option: string, isMulti: boolean) => {
    setSelections(prev => {
      const current = prev[questionId] || [];
      if (isMulti) {
        const updated = current.includes(option)
          ? current.filter(o => o !== option)
          : [...current, option];
        return { ...prev, [questionId]: updated };
      }
      return { ...prev, [questionId]: [option] };
    });
  };

  const handleSubmit = () => {
    const parts = questions.map(q => {
      const selected = selections[q.id] || [];
      if (selected.length === 0) return null;
      return `${q.question}: ${selected.join(", ")}`;
    }).filter(Boolean);

    if (parts.length > 0) {
      onAnswer(parts.join(". "));
    }
  };

  const hasSelections = Object.values(selections).some(s => s.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <HelpCircle className="h-4.5 w-4.5 text-amber-500" />
        </div>
        <div className="pt-1.5">
          <p className="text-sm text-foreground leading-relaxed">{message}</p>
        </div>
      </div>
      <div className="space-y-4 pl-12">
        {questions.map((q) => {
          const isMulti = q.type === "multi_select";
          const selected = selections[q.id] || [];
          return (
            <div key={q.id} className="space-y-2.5">
              <p className="text-sm font-medium text-foreground">{q.question}</p>
              {isMulti && <p className="text-[11px] text-muted-foreground -mt-1">Puedes seleccionar varias opciones</p>}
              {q.options && q.options.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt) => {
                    const isSelected = selected.includes(opt);
                    return (
                      <button
                        key={opt}
                        onClick={() => toggleOption(q.id, opt, isMulti)}
                        className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-all font-medium ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary shadow-sm"
                            : "border-border bg-card hover:bg-muted/80 hover:border-primary/30 text-foreground"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {hasSelections && (
          <Button size="sm" onClick={handleSubmit} className="mt-2 gap-2">
            <Send className="h-3.5 w-3.5" /> Confirmar selección
          </Button>
        )}
      </div>
    </div>
  );
}
