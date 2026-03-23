import { ClarifyingQuestion } from "@/types/dashdinamics";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";

interface ClarificationCardProps {
  message: string;
  questions: ClarifyingQuestion[];
  onAnswer: (answer: string) => void;
}

export function ClarificationCard({ message, questions, onAnswer }: ClarificationCardProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <HelpCircle className="h-4 w-4 text-amber-400" />
        </div>
        <p className="text-sm text-foreground pt-1">{message}</p>
      </div>
      <div className="space-y-3 pl-11">
        {questions.map((q) => (
          <div key={q.id} className="space-y-2">
            <p className="text-sm font-medium text-foreground">{q.question}</p>
            {q.options && q.options.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => (
                  <Button
                    key={opt}
                    variant="outline"
                    size="sm"
                    className="text-xs border-border hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
                    onClick={() => onAnswer(opt)}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
