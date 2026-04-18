import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Leaf, Settings2 } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const FACTOR_KEY = "voltguard.co2_factor";
const DEFAULT_FACTOR = 0.82; // kg CO2 per kWh (India grid avg)

export function CarbonCard({ meterId }: { meterId: string }) {
  const [factor, setFactor] = useState<number>(() => {
    const v = Number(localStorage.getItem(FACTOR_KEY));
    return v > 0 ? v : DEFAULT_FACTOR;
  });
  const [draft, setDraft] = useState<string>(String(factor));
  const [kwh7d, setKwh7d] = useState<number>(0);
  const [kwh30d, setKwh30d] = useState<number>(0);

  useEffect(() => {
    if (!meterId) return;
    (async () => {
      const since30 = new Date(); since30.setDate(since30.getDate() - 30);
      const since7 = new Date(); since7.setDate(since7.getDate() - 7);
      const { data } = await supabase
        .from("meter_readings")
        .select("power_kwh, recorded_at")
        .eq("meter_id", meterId)
        .gte("recorded_at", since30.toISOString())
        .limit(10000);
      let s30 = 0, s7 = 0;
      const t7 = since7.getTime();
      for (const r of (data ?? [])) {
        const v = Number(r.power_kwh);
        s30 += v;
        if (new Date(r.recorded_at).getTime() >= t7) s7 += v;
      }
      setKwh7d(s7); setKwh30d(s30);
    })();
  }, [meterId]);

  const co2_7d = useMemo(() => kwh7d * factor, [kwh7d, factor]);
  const co2_30d = useMemo(() => kwh30d * factor, [kwh30d, factor]);
  // Trees needed to offset (1 mature tree absorbs ~21 kg CO2/year → ~0.0575 kg/day)
  const trees = useMemo(() => Math.max(0, Math.round(co2_30d / (0.0575 * 30))), [co2_30d]);

  const save = () => {
    const v = Number(draft);
    if (!(v > 0)) return toast.error("Enter a positive number");
    localStorage.setItem(FACTOR_KEY, String(v));
    setFactor(v);
    toast.success(`Emission factor set to ${v} kg CO₂/kWh`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5 relative overflow-hidden"
    >
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-secondary/10 blur-3xl pointer-events-none" />
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-secondary/15 flex items-center justify-center">
            <Leaf className="w-4 h-4 text-secondary" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Carbon footprint</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">@ {factor} kg CO₂/kWh</p>
          </div>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7"><Settings2 className="w-3.5 h-3.5" /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <Label className="text-xs">Grid emission factor (kg CO₂ / kWh)</Label>
            <p className="text-[10px] text-muted-foreground mt-1 mb-2">
              India ~0.82 · EU ~0.25 · Norway ~0.02
            </p>
            <div className="flex gap-2">
              <Input type="number" step="0.01" min="0" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <Button size="sm" onClick={save}>Save</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Last 7d</p>
          <p className="font-display text-2xl font-bold text-secondary mt-1">{co2_7d.toFixed(2)}<span className="text-sm text-muted-foreground ml-1">kg</span></p>
          <p className="text-[10px] text-muted-foreground font-mono">{kwh7d.toFixed(2)} kWh</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Last 30d</p>
          <p className="font-display text-2xl font-bold text-secondary mt-1">{co2_30d.toFixed(2)}<span className="text-sm text-muted-foreground ml-1">kg</span></p>
          <p className="text-[10px] text-muted-foreground font-mono">{kwh30d.toFixed(2)} kWh</p>
        </div>
      </div>

      {trees > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-[11px] text-muted-foreground">
            🌳 ≈ <span className="text-secondary font-semibold">{trees}</span> mature {trees === 1 ? "tree" : "trees"} needed to offset this month
          </p>
        </div>
      )}
    </motion.div>
  );
}
