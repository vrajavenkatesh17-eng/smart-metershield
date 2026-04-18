import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit: string;
  trend?: number; // percent
  accent?: "primary" | "secondary" | "warning";
  pulse?: boolean;
}

export const MetricCard = ({ icon: Icon, label, value, unit, trend, accent = "primary", pulse }: Props) => {
  const accentColor =
    accent === "secondary" ? "hsl(var(--secondary))" :
    accent === "warning" ? "hsl(var(--risk-mid))" :
    "hsl(var(--primary))";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass glass-hover rounded-2xl p-5 relative overflow-hidden"
    >
      {pulse && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: accentColor }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: accentColor }} />
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">live</span>
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${accentColor.replace(")", " / 0.15)")}`, border: `1px solid ${accentColor.replace(")", " / 0.3)")}` }}
        >
          <Icon className="w-4 h-4" style={{ color: accentColor }} />
        </div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <motion.span
          key={String(value)}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-3xl font-bold tabular-nums"
        >
          {value}
        </motion.span>
        <span className="text-sm text-muted-foreground font-mono">{unit}</span>
      </div>
      {typeof trend === "number" && (
        <div className={cn("text-xs mt-2 font-mono", trend >= 0 ? "text-primary" : "text-risk-high")}>
          {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}% vs avg
        </div>
      )}
    </motion.div>
  );
};
