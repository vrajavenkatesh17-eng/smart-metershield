import { motion } from "framer-motion";

interface Props {
  score: number; // 0-100
  status: "normal" | "suspicious" | "theft";
}

export const RiskGauge = ({ score, status }: Props) => {
  const radius = 80;
  const circ = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, score));
  const offset = circ - (pct / 100) * circ;

  const color =
    status === "theft" ? "hsl(var(--risk-high))" :
    status === "suspicious" ? "hsl(var(--risk-mid))" :
    "hsl(var(--risk-low))";

  const label =
    status === "theft" ? "THEFT DETECTED" :
    status === "suspicious" ? "SUSPICIOUS" : "NORMAL";

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg width="220" height="220" className="-rotate-90">
        <defs>
          <linearGradient id="riskGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.6" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx="110" cy="110" r={radius} stroke="hsl(var(--muted))" strokeWidth="14" fill="none" opacity="0.4" />
        <motion.circle
          cx="110" cy="110" r={radius}
          stroke="url(#riskGrad)"
          strokeWidth="14"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          filter="url(#glow)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          key={score}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="font-display text-5xl font-bold"
          style={{ color }}
        >
          {Math.round(score)}
        </motion.span>
        <span className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Risk Score</span>
        <span
          className="mt-3 text-xs font-mono px-3 py-1 rounded-full font-semibold"
          style={{
            color,
            background: `${color.replace(")", " / 0.12)")}`,
            border: `1px solid ${color.replace(")", " / 0.4)")}`,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
};
