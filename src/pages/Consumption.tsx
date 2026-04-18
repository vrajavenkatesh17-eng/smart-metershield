import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { getTariff, setTariff, formatCurrency } from "@/lib/cost";
import { Zap, Calendar, Save, Download, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { UsageHeatmap } from "@/components/UsageHeatmap";

type Range = "daily" | "weekly" | "monthly";
interface Meter { id: string; meter_number: string; label: string | null; }
interface Reading { power_kwh: number; recorded_at: string; }

const RANGE_DAYS: Record<Range, number> = { daily: 1, weekly: 7, monthly: 30 };

export default function Consumption() {
  const [meters, setMeters] = useState<Meter[]>([]);
  const [meterId, setMeterId] = useState<string>("");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [prevReadings, setPrevReadings] = useState<Reading[]>([]);
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
      const days = RANGE_DAYS[range];
      const since = new Date(); since.setDate(since.getDate() - days);
      const prevSince = new Date(); prevSince.setDate(prevSince.getDate() - days * 2);
      const prevUntil = new Date(since);

      const [{ data: cur }, { data: prev }] = await Promise.all([
        supabase.from("meter_readings").select("power_kwh, recorded_at")
          .eq("meter_id", meterId).gte("recorded_at", since.toISOString())
          .order("recorded_at", { ascending: true }).limit(5000),
        supabase.from("meter_readings").select("power_kwh, recorded_at")
          .eq("meter_id", meterId)
          .gte("recorded_at", prevSince.toISOString()).lt("recorded_at", prevUntil.toISOString())
          .order("recorded_at", { ascending: true }).limit(5000),
      ]);
      setReadings((cur ?? []) as Reading[]);
      setPrevReadings((prev ?? []) as Reading[]);
      setLoading(false);
    })();
  }, [meterId, range]);

  const fmt = (d: Date) => {
    if (range === "daily") return `${d.getHours().toString().padStart(2, "0")}:00`;
    if (range === "weekly") return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const buckets = useMemo(() => {
    if (readings.length === 0) return [];
    const map = new Map<string, number>();
    for (const r of readings) {
      const key = fmt(new Date(r.recorded_at));
      map.set(key, (map.get(key) ?? 0) + Number(r.power_kwh));
    }
    return Array.from(map.entries()).map(([label, kwh]) => ({ label, kwh: Number(kwh.toFixed(4)), cost: kwh * tariff }));
  }, [readings, range, tariff]);

  // Comparison data: align previous period buckets index-by-index
  const comparison = useMemo(() => {
    const prevByBucket = new Map<string, number>();
    for (const r of prevReadings) {
      const d = new Date(r.recorded_at);
      // shift forward by `days` so labels align with current
      d.setDate(d.getDate() + RANGE_DAYS[range]);
      const key = fmt(d);
      prevByBucket.set(key, (prevByBucket.get(key) ?? 0) + Number(r.power_kwh));
    }
    return buckets.map((b) => ({
      label: b.label,
      current: b.kwh,
      previous: Number((prevByBucket.get(b.label) ?? 0).toFixed(4)),
    }));
  }, [buckets, prevReadings, range]);

  const totalKwh = useMemo(() => buckets.reduce((s, b) => s + b.kwh, 0), [buckets]);
  const totalPrev = useMemo(() => prevReadings.reduce((s, r) => s + Number(r.power_kwh), 0), [prevReadings]);
  const totalCost = totalKwh * tariff;
  const avgPerBucket = buckets.length ? totalKwh / buckets.length : 0;
  const delta = totalPrev > 0 ? ((totalKwh - totalPrev) / totalPrev) * 100 : 0;
  const periodLabel = range === "daily" ? "yesterday" : range === "weekly" ? "last week" : "last month";

  const saveTariff = () => {
    if (!Number.isFinite(tariff) || tariff <= 0) { toast.error("Tariff must be a positive number"); return; }
    setTariff(tariff);
    toast.success(`Tariff saved: ${formatCurrency(tariff)}/kWh`);
  };

  const exportCSV = () => {
    if (buckets.length === 0) { toast.error("Nothing to export"); return; }
    const header = ["bucket", "kwh", "cost", "previous_kwh"].join(",");
    const rows = comparison.map((b) => [b.label, b.current, (b.current * tariff).toFixed(4), b.previous].join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const meter = meters.find((m) => m.id === meterId);
    const a = document.createElement("a");
    a.href = url; a.download = `voltguard-${meter?.meter_number ?? "meter"}-${range}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const exportPDF = async () => {
    const meter = meters.find((m) => m.id === meterId);
    // fetch recent alerts for richer report
    const { data: alerts } = await supabase
      .from("alerts").select("title, severity, risk_score, created_at, ai_explanation")
      .eq("meter_id", meterId).order("created_at", { ascending: false }).limit(10);

    const doc = new jsPDF();
    doc.setFontSize(20); doc.setTextColor(20, 184, 166);
    doc.text("VoltGuard AI", 14, 18);
    doc.setFontSize(11); doc.setTextColor(60);
    doc.text("Smart Energy Intelligence Report", 14, 25);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Meter: ${meter?.meter_number ?? "—"}${meter?.label ? " · " + meter.label : ""}`, 14, 34);
    doc.text(`Period: ${range} · Generated ${new Date().toLocaleString()}`, 14, 40);

    doc.setFontSize(13); doc.setTextColor(20);
    doc.text("Usage Summary", 14, 52);
    autoTable(doc, {
      startY: 56,
      head: [["Metric", "Value"]],
      body: [
        ["Total kWh", totalKwh.toFixed(3)],
        ["Estimated cost", formatCurrency(totalCost)],
        ["Tariff", `${formatCurrency(tariff)}/kWh`],
        [`Avg per ${range === "daily" ? "hour" : "day"}`, `${avgPerBucket.toFixed(3)} kWh`],
        [`Δ vs ${periodLabel}`, `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`],
      ],
      headStyles: { fillColor: [20, 184, 166] }, styles: { fontSize: 9 },
    });

    const afterSummary = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    doc.setFontSize(13); doc.text("Bucketed Consumption", 14, afterSummary);
    autoTable(doc, {
      startY: afterSummary + 4,
      head: [["Bucket", "kWh", "Cost", `Prev ${periodLabel} kWh`]],
      body: comparison.map((b) => [b.label, b.current.toFixed(4), formatCurrency(b.current * tariff), b.previous.toFixed(4)]),
      headStyles: { fillColor: [99, 102, 241] }, styles: { fontSize: 8 },
    });

    if (alerts && alerts.length > 0) {
      const afterBuckets = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      doc.setFontSize(13); doc.text("Theft / Anomaly Log", 14, afterBuckets);
      autoTable(doc, {
        startY: afterBuckets + 4,
        head: [["When", "Severity", "Risk", "Title", "AI Note"]],
        body: alerts.map((a) => [
          new Date(a.created_at).toLocaleString(),
          a.severity, String(a.risk_score), a.title,
          (a.ai_explanation ?? "").slice(0, 80),
        ]),
        headStyles: { fillColor: [239, 68, 68] }, styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: { 4: { cellWidth: 60 } },
      });
    }

    doc.save(`voltguard-${meter?.meter_number ?? "report"}-${range}.pdf`);
    toast.success("PDF report downloaded");
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Consumption & Cost</h1>
          <p className="text-muted-foreground text-sm mt-1">Breakdown of energy usage and estimated billing.</p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-2" />CSV</Button>
          <Button variant="outline" onClick={exportPDF}><FileText className="w-4 h-4 mr-2" />PDF</Button>
        </div>
      </div>

      <Card className="glass border-primary/20 p-5 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="tariff" className="text-xs uppercase tracking-wider text-muted-foreground">Tariff (₹ per kWh)</Label>
            <Input id="tariff" type="number" step="0.01" min="0" value={tariff}
              onChange={(e) => setTariffState(Number(e.target.value))} className="mt-1.5 font-mono" />
          </div>
          <Button onClick={saveTariff} className="bg-gradient-primary text-primary-foreground">
            <Save className="w-4 h-4 mr-2" /> Save tariff
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
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
        <Card className={`glass p-5 ${delta >= 0 ? "border-risk-high/40" : "border-secondary/40"}`}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            {delta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            vs {periodLabel}
          </div>
          <p className={`font-display text-3xl font-bold mt-2 ${delta >= 0 ? "text-risk-high" : "text-secondary"}`}>
            {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">prev: {totalPrev.toFixed(3)} kWh</p>
        </Card>
      </div>

      <Card className="glass p-6 mb-6">
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
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                      formatter={(v: number) => [`${v.toFixed(4)} kWh`, "Energy"]} />
                    <Bar dataKey="kwh" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Period-over-period comparison */}
      <Card className="glass p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-lg">This {range.replace("ly", "")} vs {periodLabel}</h3>
          <span className={`text-sm font-mono px-3 py-1 rounded-full ${delta >= 0 ? "bg-risk-high/10 text-risk-high" : "bg-secondary/10 text-secondary"}`}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
          </span>
        </div>
        {comparison.length === 0 ? (
          <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">Not enough data yet for comparison.</div>
        ) : (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="previous" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name={`Previous ${range}`} opacity={0.6} />
                <Bar dataKey="current" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={`Current ${range}`} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Hour-of-day × day-of-week heatmap */}
      <div className="mt-6">
        <UsageHeatmap meterId={meterId} />
      </div>
    </AppShell>
  );
}
