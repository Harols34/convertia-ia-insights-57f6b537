import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface PlaceholderModuleProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function PlaceholderModule({ title, description, icon: Icon }: PlaceholderModuleProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">{title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{description}</p>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[400px] rounded-xl border border-dashed border-border bg-muted/20"
      >
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-display font-semibold text-lg mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm text-center">
          Este módulo está en construcción. Próximamente podrás acceder a todas las funcionalidades de {title.toLowerCase()}.
        </p>
      </motion.div>
    </div>
  );
}
