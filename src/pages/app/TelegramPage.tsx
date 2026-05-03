import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { TelegramSettings } from "@/components/settings/TelegramSettings";

export default function TelegramPage() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Send className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Telegram</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Conecta tu cuenta a <strong>@Convertiabot</strong> y consulta KPIs, dashboards y análisis de IA
              desde cualquier dispositivo.
            </p>
          </div>
        </div>
      </motion.div>

      <TelegramSettings />
    </div>
  );
}
