import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Flame } from "lucide-react";

interface Reading { power_kwh: number; recorded_at: string; }

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function UsageHeatmap({ meterId }: { meterId: string }) {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!meterId) return;
    setLoading(true);
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data } = await supabase
        .from("meter_readings")
        .select("power_kwh, recorded_at")
        .eq("meter_id", meterId)
        .gte("recorded_at", since.toISOString())
        .order("recorded_at", { ascending: true })
        .limit(10000);
      setReadings((data ?? []) as Reading[]);
      setLoading(false);
    })();
  }, [meterId]);

  const { grid, max, peak } = useMemo(() => {
    // 7 days × 24 hours
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const r of readings) {
      const d = new Date(r.recorded_at);
      g[d.getDay()][d.getHours()] += Number(r.power_kwh);
    }
    let m = 0;
    let pk = { d: 0, h: 0, v: 0 };
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
      if (g[d][h] > m) m = g[d][h];
      if (g[d][h] > pk.v) pk = { d, h, v: g[d][h] };
    }
    return { grid: g, max: m, peak: pk };
  }, [readings]);

  const cellColor = (v: number) => {
    if (max === 0 || v === 0) return "hsl(220 25% 12%)";
    const t = Math.pow(v / max, 0.7); // gamma for punchier mids
    // cyan → green → yellow → orange → magenta-red
    const stops = [
      { p: 0.0, h: 190, s: 95, l: 35 },
      { p: 0.35, h: 145, s: 90, l: 48 },
      { p: 0.6, h: 55, s: 100, l: 55 },
      { p: 0.8, h: 25, s: 100, l: 55 },
      { p: 1.0, h: 340, s: 95, l: 58 },
    ];
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].p && t <= stops[i + 1].p) { a = stops[i]; b = stops[i + 1]; break; }
    }
    const k = (t - a.p) / Math.max(0.0001, b.p - a.p);
    const h = a.h + (b.h - a.h) * k;
    const s = a.s + (b.s - a.s) * k;
    const l = a.l + (b.l - a.l) * k;
    const glow = t > 0.7 ? `0 0 ${4 + t * 8}px hsl(${h} ${s}% ${l}% / 0.7)` : "none";
    return { background: `hsl(${h} ${s}% ${l}%)`, boxShadow: glow } as const;
  };

  return (
    <Card className="glass p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold text-lg flex items-center gap-2">
            <Flame className="w-4 h-4 text-risk-high" /> Usage Heatmap
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            kWh by hour of day × day of week (last 30 days)
          </p>
        </div>
        {peak.v > 0 && (
          <div className="text-right text-xs">
            <p className="text-muted-foreground">Peak</p>
            <p className="font-mono font-semibold text-risk-high">
              {DAYS[peak.d]} {peak.h.toString().padStart(2, "0")}:00
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
      ) : max === 0 ? (
        <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
          Not enough data yet — keep streaming readings.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Hour header — every hour */}
            <div className="flex gap-[2px] ml-10 mb-1">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="w-[18px] text-[9px] text-muted-foreground text-center font-mono tabular-nums">
                  {h.toString().padStart(2, "0")}
                </div>
              ))}
            </div>
            {grid.map((row, d) => (
              <div key={d} className="flex gap-[2px] items-center mb-[2px]">
                <div className="w-10 text-[10px] text-muted-foreground font-mono">{DAYS[d]}</div>
                {row.map((v, h) => {
                  const s = cellColor(v);
                  return (
                    <div
                      key={h}
                      className="w-[18px] h-[18px] rounded-[3px] transition-transform hover:scale-150 hover:z-10 relative cursor-pointer"
                      style={s as React.CSSProperties}
                      title={`${DAYS[d]} ${h.toString().padStart(2, "0")}:00 — ${v.toFixed(3)} kWh`}
                    />
                  );
                })}
              </div>
            ))}
            {/* Legend */}
            <div className="flex items-center gap-2 mt-3 ml-10">
              <span className="text-[10px] text-muted-foreground">0</span>
              <div className="flex gap-[2px]">
                {[0.05, 0.2, 0.4, 0.6, 0.8, 1].map((p, i) => (
                  <div key={i} className="w-5 h-2.5 rounded-sm" style={cellColor(p * max) as React.CSSProperties} />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">{max.toFixed(2)} kWh</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
