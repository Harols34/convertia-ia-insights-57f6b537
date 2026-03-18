import { motion } from "framer-motion";

const logos = [
  "TechCorp", "DataFlow", "FinanceAI", "RetailPro", "InsureTech",
  "MediaGroup", "SalesForce+", "CloudBank",
];

export function SocialProofSection() {
  return (
    <section className="py-16 border-y border-border gradient-hero">
      <div className="container">
        <p className="text-center text-sm text-white/50 uppercase tracking-widest mb-10 font-semibold">
          Empresas que confían en nosotros
        </p>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center items-center gap-x-12 gap-y-6"
        >
          {logos.map((name) => (
            <span
              key={name}
              className="text-xl font-display font-bold text-white/30 hover:text-white/60 transition-colors select-none"
            >
              {name}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
