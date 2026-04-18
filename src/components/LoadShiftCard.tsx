import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { TrendingDown, Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getTariff, formatCurrency } from "@/lib/cost";
import { toast } from "sonner";

const PEAK_KEY = "voltguard.peak_multiplier";
const OFFPEAK_KEY = "voltguard.offpeak_multiplier";

interface Reading { power_kwh: number; recorded_at: string; }

export function LoadShiftCard({ meterId }: { meterId: string }) {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [peakMul, setPeakMul] = useState<number>(() => Number(localStorage.getItem(PEAK_KEY)) || 1.5);
  const [offMul, setOffMul] = useState<number>(() => Number(localStorage.getItem(OFFPEAK_KEY)) || 0.7);
  const [draftP, setDraftP] = useState(String(peakMul));
  const [draftO, setDraftO] = useState(String(offMul));
  const tariff = getTariff();

  useEffect(() => {
    if (!meterId) return;
    (async () => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const { data } = await supabase
        .from("meter_readings")
        .select("power_kwh, recorded_at")
        .eq("meter_id", meterId)
        .gte("recorded_at", since.toISOString())
        .limit(10000);
      setReadings((data ?? []) as Reading[]);
    })();
  }, [meterId]);

  const { peakHours, peakKwh, savings, baselineCost } = useMemo(() => {
    if (readings.length === 0) return { peakHours: [] as number[], peakKwh: 0, savings: 0, baselineCost: 0 };
    const hourly = Array(24).fill(0);
    for (const r of readings) hourly[new Date(r.recorded_at).getHours()] += Number(r.power_kwh);
    const total = hourly.reduce((a, b) => a + b, 0);
    if (total === 0) return { peakHours: [], peakKwh: 0, savings: 0, baselineCost: 0 };
    // Top 4 hours = peak
    const ranked = hourly.map((v, h) => ({ h, v })).sort((a, b) => b.v - a.v);
    const peaks = ranked.slice(0, 4).map((x) => x.h).sort((a, b) => a - b);
    const pKwh = ranked.slice(0, 4).reduce((s, x) => s + x.v, 0);
    // Cost if everything in peak hours moved to off-peak rate
    const baseline = pKwh * tariff * peakMul;
    const shifted = pKwh * tariff * offMul;
    return { peakHours: peaks, peakKwh: pKwh, savings: baseline - shifted, baselineCost: baseline };
  }, [readings, tariff, peakMul, offMul]);

  const save = () => {
    const p = Number(draftP), o = Number(draftO);
    if (!(p > 0) || !(o > 0)) return toast.error("Enter positive multipliers");
    localStorage.setItem(PEAK_KEY, String(p));
    localStorage.setItem(OFFPEAK_KEY, String(o));
    setPeakMul(p); setOffMul(o);
    toast.success("Tariff multipliers saved");
  };

  const pct = baselineCost > 0 ? (savings / baselineCost) * 100 : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <TrendingDown className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Load-shift savings</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">If peak load moved off-peak (30d)</p>
          </div>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7"><Settings2 className="w-3.5 h-3.5" /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-72">
            <Label className="text-xs">Peak rate multiplier</Label>
            <Input type="number" step="0.1" min="0" value={draftP} onChange={(e) => setDraftP(e.target.value)} className="mt-1 mb-3" />
            <Label className="text-xs">Off-peak rate multiplier</Label>
            <Input type="number" step="0.1" min="0" value={draftO} onChange={(e) => setDraftO(e.target.value)} className="mt-1 mb-3" />
            <Button size="sm" onClick={save} className="w-full">Save</Button>
          </PopoverContent>
        </Popover>
      </div>

      {peakHours.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Not enough data yet.</p>
      ) : (
        <>
          <p className="font-display text-3xl font-bold text-primary">
            {formatCurrency(savings)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            ≈ <span className="text-primary font-semibold">{pct.toFixed(0)}%</span> off your peak-hour bill
          </p>
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-[10px] uppercase text-muted-foreground mb-1">Top peak hours</p>
            <div className="flex flex-wrap gap-1.5">
              {peakHours.map((h) => (
                <span key={h} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-risk-high/15 text-risk-high border border-risk-high/30">
                  {h.toString().padStart(2, "0")}:00
                </span>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 font-mono">{peakKwh.toFixed(2)} kWh in peak</p>
          </div>
        </>
      )}
    </motion.div>
  );
}
