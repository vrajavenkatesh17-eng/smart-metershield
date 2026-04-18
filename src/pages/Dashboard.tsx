import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { LiveChart, ChartPoint } from "@/components/LiveChart";
import { RiskGauge } from "@/components/RiskGauge";
import { EnergyTips } from "@/components/EnergyTips";
import { ForecastChart } from "@/components/ForecastChart";
import { CarbonCard } from "@/components/CarbonCard";
import { supabase } from "@/integrations/supabase/client";
import { generateReading, SimMode } from "@/lib/simulator";
import { Bolt, Activity, Gauge as GaugeIcon, Zap, Play, Pause, AlertTriangle, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Meter { id: string; meter_number: string; label: string | null; }

const MAX_POINTS = 30;

export default function Dashboard() {
  const [params] = useSearchParams();
  const [meters, setMeters] = useState<Meter[]>([]);
  const [meterId, setMeterId] = useState<string>(params.get("meter") ?? "");
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [running, setRunning] = useState(true);
  const [mode, setMode] = useState<SimMode>("normal");
  const [risk, setRisk] = useState<{ score: number; status: "normal" | "suspicious" | "theft"; explanation?: string }>({ score: 12, status: "normal" });
  const [analyzing, setAnalyzing] = useState(false);
  const tickRef = useRef<number | null>(null);
  const sinceAnalysis = useRef(0);

  // Load meters
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("meters").select("id, meter_number, label").order("created_at");
      setMeters((data ?? []) as Meter[]);
      if (!meterId && data && data.length > 0) setMeterId(data[0].id);
    })();
  }, [meterId]);

  // Load history when meter changes
  useEffect(() => {
    if (!meterId) return;
    setPoints([]);
    (async () => {
      const { data } = await supabase
        .from("meter_readings")
        .select("voltage,current,power_kwh,recorded_at")
        .eq("meter_id", meterId)
        .order("recorded_at", { ascending: false })
        .limit(MAX_POINTS);
      const hist = (data ?? []).reverse().map((r) => ({
        ts: new Date(r.recorded_at).getTime(),
        voltage: Number(r.voltage),
        current: Number(r.current),
        power_kwh: Number(r.power_kwh),
      }));
      setPoints(hist);
    })();
  }, [meterId]);

  // Live simulator
  useEffect(() => {
    if (!running || !meterId) return;
    const tick = async () => {
      const r = generateReading(mode);
      setPoints((p) => [...p.slice(-MAX_POINTS + 1), { ts: r.ts, voltage: r.voltage, current: r.current, power_kwh: r.power_kwh }]);

      // Persist
      await supabase.from("meter_readings").insert({
        meter_id: meterId,
        voltage: r.voltage,
        current: r.current,
        power_kwh: r.power_kwh,
      });

      sinceAnalysis.current += 1;
      // Run anomaly detection every 5 readings
      if (sinceAnalysis.current >= 5) {
        sinceAnalysis.current = 0;
        try {
          setAnalyzing(true);
          const { data, error } = await supabase.functions.invoke("detect-anomaly", { body: { meter_id: meterId } });
          if (!error && data) {
            setRisk({ score: data.risk_score, status: data.status, explanation: data.explanation });
            if (data.status === "theft") toast.error(`⚠ Theft detected on meter`, { description: data.explanation });
            else if (data.status === "suspicious") toast.warning(`Suspicious activity`, { description: data.explanation });
          }
        } finally {
          setAnalyzing(false);
        }
      }
    };
    tickRef.current = window.setInterval(tick, 2500);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, [running, mode, meterId]);

  const latest = points[points.length - 1];
  const avgPower = useMemo(() => points.length ? points.reduce((s, p) => s + p.power_kwh, 0) / points.length : 0, [points]);
  const trendPower = latest && avgPower ? ((latest.power_kwh - avgPower) / avgPower) * 100 : 0;

  const exportPDF = () => {
    const doc = new jsPDF();
    const meter = meters.find((m) => m.id === meterId);
    doc.setFontSize(18);
    doc.text("VoltGuard — Meter Report", 14, 18);
    doc.setFontSize(11);
    doc.text(`Meter: ${meter?.meter_number ?? "—"}  ${meter?.label ?? ""}`, 14, 28);
    doc.text(`Risk Score: ${Math.round(risk.score)} / 100   Status: ${risk.status.toUpperCase()}`, 14, 35);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 42);
    autoTable(doc, {
      startY: 50,
      head: [["Time", "Voltage (V)", "Current (A)", "Power (kWh)"]],
      body: points.slice(-25).map((p) => [
        new Date(p.ts).toLocaleTimeString(),
        p.voltage.toFixed(2),
        p.current.toFixed(3),
        p.power_kwh.toFixed(4),
      ]),
      headStyles: { fillColor: [34, 211, 160] },
    });
    doc.save(`voltguard-${meter?.meter_number ?? "report"}.pdf`);
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Live Monitoring</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time telemetry & AI theft detection.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={meterId} onValueChange={setMeterId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select meter" /></SelectTrigger>
            <SelectContent>
              {meters.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="font-mono text-xs">{m.meter_number}</span>{m.label ? ` · ${m.label}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={mode} onValueChange={(v) => setMode(v as SimMode)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal load</SelectItem>
              <SelectItem value="spike">⚡ Power spike</SelectItem>
              <SelectItem value="bypass">🔧 Meter bypass</SelectItem>
              <SelectItem value="tamper">⚠ Tampering</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setRunning((r) => !r)}>
            {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button variant="outline" onClick={exportPDF}><FileDown className="w-4 h-4 mr-2" />PDF</Button>
        </div>
      </div>

      {!meterId ? (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-muted-foreground">No meter selected. <a href="/meters" className="text-primary underline">Register a meter</a> to begin.</p>
        </div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <MetricCard icon={Bolt} label="Voltage" value={latest?.voltage.toFixed(1) ?? "—"} unit="V" pulse={running} />
            <MetricCard icon={Activity} label="Current" value={latest?.current.toFixed(2) ?? "—"} unit="A" accent="secondary" pulse={running} />
            <MetricCard icon={Zap} label="Power" value={latest?.power_kwh.toFixed(3) ?? "—"} unit="kWh" trend={trendPower} pulse={running} />
            <MetricCard icon={GaugeIcon} label="Avg load" value={avgPower.toFixed(3)} unit="kWh" accent="secondary" />
          </div>

          {/* Chart + Risk gauge */}
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2"><LiveChart data={points} /></div>
            <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
              {analyzing && <div className="absolute top-3 left-3 text-[10px] font-mono text-muted-foreground animate-pulse">analyzing…</div>}
              <h3 className="font-display font-semibold text-lg mb-4 self-start">Theft Risk Score</h3>
              <RiskGauge score={risk.score} status={risk.status} />
              <AnimatePresence>
                {risk.explanation && risk.status !== "normal" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-5 w-full p-3 rounded-xl border border-risk-high/30 bg-risk-high/5"
                  >
                    <div className="flex items-start gap-2 text-xs">
                      <AlertTriangle className="w-4 h-4 text-risk-high shrink-0 mt-0.5" />
                      <p className="text-foreground/90 leading-relaxed">{risk.explanation}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Forecast + AI tips + Carbon */}
          <div className="grid lg:grid-cols-3 gap-4 mt-4">
            <div className="lg:col-span-2"><ForecastChart meterId={meterId} /></div>
            <div className="space-y-4">
              <CarbonCard meterId={meterId} />
              <EnergyTips meterId={meterId} />
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
