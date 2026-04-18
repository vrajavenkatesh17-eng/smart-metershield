import { motion } from "framer-motion";

export const Logo = ({ size = 36 }: { size?: number }) => (
  <div className="flex items-center gap-2.5">
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 bg-gradient-primary rounded-xl blur-md opacity-60" />
      <svg viewBox="0 0 32 32" className="relative" style={{ width: size, height: size }}>
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="hsl(var(--primary-glow))" />
            <stop offset="1" stopColor="hsl(var(--secondary))" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
        <path d="M17 5 L8 18 H14 L13 27 L24 12 H17 Z" fill="url(#lg)" />
      </svg>
    </motion.div>
    <span className="font-display font-bold text-xl tracking-tight">
      Volt<span className="text-gradient">Guard</span>
    </span>
  </div>
);
