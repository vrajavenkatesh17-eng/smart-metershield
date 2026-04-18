import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { getTariff, setTariff, formatCurrency } from "@/lib/cost";
import { Zap, Calendar, Save } from "lucide-react";
import { toast } from "sonner";

type Range = "daily" | "weekly" | "monthly";
interface Meter { id: string; meter_number: string; label: string | null; }
interface Reading { power_kwh: number; recorded_at: string; }

const RANGE_DAYS: Record<Range, number> = { daily: 1, weekly: 7, monthly: 30 };

export default function Consumption() {
  const [meters, setMeters] = useState<Meter[]>([]);
  const [meterId, setMeterId] = useState<string>("");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [range, setRange] = useState<Range>("weekly");
  const [tariff, setTariffState] = useState<number>(getTariff());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("meters").select("id, meter_number, label").order("created_at");
      setMeters((data ?? []) as Meter[]);
      if (data && data.length > 0) setMeterId(data[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!meterId) return;
    setLoading(true);
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - RANGE_DAYS[range]);
      const { data } = await supabase
        .from("meter_readings")
        .select("power_kwh, recorded_at")
        .eq("meter_id", meterId)
        .gte("recorded_at", since.toISOString())
        .order("recorded_at", { ascending: true })
        .limit(5000);
      setReadings((data ?? []) as Reading[]);
      setLoading(false);
    })();
  }, [meterId, range]);

  // Bucket readings
  const buckets = useMemo(() => {
    if (readings.length === 0) return [];
    const map = new Map<string, number>();
    const fmt = (d: Date) => {
      if (range === "daily") return `${d.getHours().toString().padStart(2, "0")}:00`;
      if (range === "weekly") return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };
    for (const r of readings) {
      const d = new Date(r.recorded_at);
      const key = fmt(d);
      map.set(key, (map.get(key) ?? 0) + Number(r.power_kwh));
    }
    return Array.from(map.entries()).map(([label, kwh]) => ({ label, kwh: Number(kwh.toFixed(4)), cost: kwh * tariff }));
  }, [readings, range, tariff]);

  const totalKwh = useMemo(() => buckets.reduce((s, b) => s + b.kwh, 0), [buckets]);
  const totalCost = totalKwh * tariff;
  const avgPerBucket = buckets.length ? totalKwh / buckets.length : 0;

  const saveTariff = () => {
    if (!Number.isFinite(tariff) || tariff <= 0) { toast.error("Tariff must be a positive number"); return; }
    setTariff(tariff);
    toast.success(`Tariff saved: ${formatCurrency(tariff)}/kWh`);
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Consumption & Cost</h1>
          <p className="text-muted-foreground text-sm mt-1">Breakdown of energy usage and estimated billing.</p>
        </div>
        <Select value={meterId} onValueChange={setMeterId}>
          <SelectTrigger className="w-[240px]"><SelectValue placeholder="Select meter" /></SelectTrigger>
          <SelectContent>
            {meters.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span className="font-mono text-xs">{m.meter_number}</span>{m.label ? ` · ${m.label}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tariff editor */}
      <Card className="glass border-primary/20 p-5 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="tariff" className="text-xs uppercase tracking-wider text-muted-foreground">Tariff (₹ per kWh)</Label>
            <Input
              id="tariff" type="number" step="0.01" min="0"
              value={tariff}
              onChange={(e) => setTariffState(Number(e.target.value))}
              className="mt-1.5 font-mono"
            />
          </div>
          <Button onClick={saveTariff} className="bg-gradient-primary text-primary-foreground">
            <Save className="w-4 h-4 mr-2" /> Save tariff
          </Button>
        </div>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="glass p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><Zap className="w-3.5 h-3.5" />Total kWh</div>
          <p className="font-display text-3xl font-bold mt-2">{totalKwh.toFixed(3)}</p>
          <p className="text-xs text-muted-foreground mt-1">{range} window</p>
        </Card>
        <Card className="glass p-5 border-primary/30">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary">Estimated cost</div>
          <p className="font-display text-3xl font-bold mt-2 text-primary">{formatCurrency(totalCost)}</p>
          <p className="text-xs text-muted-foreground mt-1">at {formatCurrency(tariff)}/kWh</p>
        </Card>
        <Card className="glass p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><Calendar className="w-3.5 h-3.5" />Avg per {range === "daily" ? "hour" : "day"}</div>
          <p className="font-display text-3xl font-bold mt-2">{avgPerBucket.toFixed(3)}</p>
          <p className="text-xs text-muted-foreground mt-1">kWh</p>
        </Card>
      </div>

      {/* Charts */}
      <Card className="glass p-6">
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList className="mb-4">
            <TabsTrigger value="daily">Daily (24h)</TabsTrigger>
            <TabsTrigger value="weekly">Weekly (7d)</TabsTrigger>
            <TabsTrigger value="monthly">Monthly (30d)</TabsTrigger>
          </TabsList>
          <TabsContent value={range} className="mt-0">
            {loading ? (
              <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
            ) : buckets.length === 0 ? (
              <div className="h-[320px] flex items-center justify-center text-muted-foreground text-sm">
                No readings yet. Stream data on the dashboard to populate.
              </div>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={buckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                      formatter={(v: number, name) => name === "cost" ? [formatCurrency(v), "Cost"] : [`${v.toFixed(4)} kWh`, "Energy"]}
                    />
                    <Bar dataKey="kwh" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </AppShell>
  );
}
