import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Trophy, Leaf } from "lucide-react";
import { motion } from "framer-motion";

const FACTOR_KEY = "voltguard.co2_factor";
const DEFAULT_FACTOR = 0.82;

interface Row {
  meter_id: string;
  meter_number: string;
  label: string | null;
  kwh: number;
  co2: number;
  intensity: number; // co2 per kWh — equal to factor right now, but kept for future per-meter mix
}

export function CarbonLeaderboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const factor = Number(localStorage.getItem(FACTOR_KEY)) || DEFAULT_FACTOR;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: meters } = await supabase
        .from("meters").select("id, meter_number, label").order("created_at");
      if (!meters || meters.length === 0) { setRows([]); setLoading(false); return; }

      const monthStart = new Date();
      monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

      const results = await Promise.all(meters.map(async (m) => {
        const { data } = await supabase
          .from("meter_readings")
          .select("power_kwh")
          .eq("meter_id", m.id)
          .gte("recorded_at", monthStart.toISOString())
          .limit(10000);
        const kwh = (data ?? []).reduce((s, r) => s + Number(r.power_kwh), 0);
        return {
          meter_id: m.id,
          meter_number: m.meter_number,
          label: m.label,
          kwh,
          co2: kwh * factor,
          intensity: factor,
        } as Row;
      }));

      // Lowest carbon intensity per kWh first; tie-break by lower total CO₂
      results.sort((a, b) => a.intensity - b.intensity || a.co2 - b.co2);
      setRows(results);
      setLoading(false);
    })();
  }, [factor]);

  const maxCo2 = useMemo(() => Math.max(0.001, ...rows.map((r) => r.co2)), [rows]);

  return (
    <Card className="glass p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold text-lg flex items-center gap-2">
            <Trophy className="w-4 h-4 text-secondary" /> Carbon Leaderboard
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Your meters ranked by lowest carbon intensity (this month) · @ {factor} kg CO₂/kWh
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">No meters registered yet.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const pct = (r.co2 / maxCo2) * 100;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
            return (
              <motion.div
                key={r.meter_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="w-8 text-center font-display font-bold text-lg">{medal}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-foreground">{r.meter_number}</span>
                    {r.label && <span className="text-xs text-muted-foreground truncate">· {r.label}</span>}
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-background overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: i * 0.05 }}
                      className="h-full rounded-full bg-gradient-to-r from-secondary via-primary to-risk-high"
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm font-semibold text-secondary flex items-center gap-1 justify-end">
                    <Leaf className="w-3 h-3" /> {r.co2.toFixed(2)} kg
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">{r.kwh.toFixed(2)} kWh</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
