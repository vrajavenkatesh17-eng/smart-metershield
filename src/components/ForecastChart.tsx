// Simple 24h forecast: groups historic kWh by hour-of-day and projects next 24h.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { TrendingUp } from "lucide-react";

interface Point { hour: string; actual?: number; predicted?: number; }

export const ForecastChart = ({ meterId }: { meterId: string }) => {
  const [readings, setReadings] = useState<{ power_kwh: number; recorded_at: string }[]>([]);

  useEffect(() => {
    if (!meterId) return;
    (async () => {
      const since = new Date(); since.setDate(since.getDate() - 7);
      const { data } = await supabase
        .from("meter_readings")
        .select("power_kwh,recorded_at")
        .eq("meter_id", meterId)
        .gte("recorded_at", since.toISOString())
        .order("recorded_at", { ascending: true })
        .limit(5000);
      setReadings((data ?? []).map((r) => ({ power_kwh: Number(r.power_kwh), recorded_at: r.recorded_at })));
    })();
  }, [meterId]);

  const data = useMemo<Point[]>(() => {
    if (readings.length === 0) return [];
    // Group by hour-of-day, build profile
    const profile: number[][] = Array.from({ length: 24 }, () => []);
    for (const r of readings) profile[new Date(r.recorded_at).getHours()].push(r.power_kwh);
    const avgProfile = profile.map((arr) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);

    // Today's actuals so far (by hour)
    const today: number[] = Array(24).fill(null);
    const now = new Date(); now.setMinutes(0, 0, 0);
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const todayBuckets: number[][] = Array.from({ length: 24 }, () => []);
    for (const r of readings) {
      const d = new Date(r.recorded_at);
      if (d >= startOfToday) todayBuckets[d.getHours()].push(r.power_kwh);
    }
    todayBuckets.forEach((arr, i) => { if (arr.length) today[i] = arr.reduce((s, x) => s + x, 0); });

    const currentHour = new Date().getHours();
    const out: Point[] = [];
    for (let h = 0; h < 24; h++) {
      out.push({
        hour: `${h.toString().padStart(2, "0")}:00`,
        actual: today[h] ?? undefined,
        predicted: h >= currentHour ? +(avgProfile[h] * (todayBuckets[h]?.length || 1)).toFixed(4) : undefined,
      });
    }
    return out;
  }, [readings]);

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="font-display font-semibold text-lg">24h Forecast — Actual vs Predicted</h3>
      </div>
      {data.length === 0 ? (
        <div className="h-[240px] flex items-center justify-center text-xs text-muted-foreground">Need at least a few hours of data to forecast.</div>
      ) : (
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine x={`${new Date().getHours().toString().padStart(2, "0")}:00`} stroke="hsl(var(--secondary))" strokeDasharray="3 3" label={{ value: "now", fill: "hsl(var(--secondary))", fontSize: 10 }} />
              <Line type="monotone" dataKey="actual" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Actual" />
              <Line type="monotone" dataKey="predicted" stroke="hsl(var(--secondary))" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Predicted" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
