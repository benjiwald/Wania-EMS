"use client";
import { motion } from "framer-motion";
import { ReactNode } from "react";

export default function KPICard({ label, value, subtitle, icon, index = 0 }: {
  label: string; value: string | number; subtitle?: string; icon: ReactNode; index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="group glass-panel rounded-2xl p-5 card-hover"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-foreground">{value}</span>
            {subtitle && <span className="text-xs font-medium text-muted-foreground">{subtitle}</span>}
          </div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 border border-border transition-colors group-hover:border-primary/20 group-hover:bg-primary/10">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
