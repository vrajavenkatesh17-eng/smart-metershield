import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface Tip { title: string; body: string; }

export const EnergyTips = ({ meterId }: { meterId: string }) => {
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(false);
  const [peakHours, setPeakHours] = useState<string>("");

  const load = async () => {
    if (!meterId) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("energy-tips", { body: { meter_id: meterId } });
    if (!error && data) {
      setTips(data.tips ?? []);
      setPeakHours(data.peakHours ?? "");
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [meterId]);

  return (
    <div className="glass rounded-2xl p-6 border-secondary/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-secondary/30 to-primary/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-secondary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-lg leading-tight">AI Energy Tips</h3>
            {peakHours && <p className="text-[10px] text-muted-foreground font-mono">peak: {peakHours}</p>}
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <div className="space-y-3">
        {loading && tips.length === 0 && <p className="text-xs text-muted-foreground">Analyzing your usage…</p>}
        {!loading && tips.length === 0 && <p className="text-xs text-muted-foreground">Stream more readings to get personalized tips.</p>}
        {tips.map((t, i) => (
          <motion.div
            key={`${t.title}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex gap-3 p-3 rounded-xl bg-card/40 border border-border/40"
          >
            <Lightbulb className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium leading-tight">{t.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t.body}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
