import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Alert {
  id: string;
  meter_id: string;
  severity: string;
  status: string;
  risk_score: number;
  title: string;
  description: string | null;
  ai_explanation: string | null;
  created_at: string;
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const load = async () => {
    const { data } = await supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(100);
    setAlerts((data ?? []) as Alert[]);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("alerts-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, (p) => {
        setAlerts((prev) => [p.new as Alert, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("alerts").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Alert ${status}`);
    load();
  };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Alerts</h1>
        <p className="text-muted-foreground text-sm mt-1">All anomaly detections, ranked by risk.</p>
      </div>

      {alerts.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">No alerts. Your grid is clean.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a, i) => {
            const isCritical = a.severity === "critical";
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                className={`glass rounded-2xl p-5 border-l-4 ${isCritical ? "border-l-risk-high" : "border-l-risk-mid"}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isCritical ? "bg-risk-high/15 text-risk-high" : "bg-risk-mid/15 text-risk-mid"}`}>
                    {isCritical ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold">{a.title}</h3>
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${isCritical ? "bg-risk-high/15 text-risk-high" : "bg-risk-mid/15 text-risk-mid"}`}>
                        risk {Math.round(a.risk_score)}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{a.status}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                    </div>
                    {a.ai_explanation && <p className="text-sm text-muted-foreground leading-relaxed">{a.ai_explanation}</p>}
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" onClick={() => updateStatus(a.id, "confirmed")}>Confirm theft</Button>
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(a.id, "dismissed")}>Dismiss</Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
