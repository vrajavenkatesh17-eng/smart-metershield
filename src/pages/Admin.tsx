import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Users, Gauge, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Stat { meters: number; alerts: number; users: number; }

export default function Admin() {
  const navigate = useNavigate();
  const [stat, setStat] = useState<Stat>({ meters: 0, alerts: 0, users: 0 });
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [allMeters, setAllMeters] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/auth");
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (!roles?.some((r) => r.role === "admin")) {
        navigate("/dashboard");
        return;
      }
      const [m, a, p] = await Promise.all([
        supabase.from("meters").select("*"),
        supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("profiles").select("user_id"),
      ]);
      setStat({ meters: m.data?.length ?? 0, alerts: a.data?.length ?? 0, users: p.data?.length ?? 0 });
      setAllMeters(m.data ?? []);
      setRecentAlerts(a.data ?? []);
    })();
  }, [navigate]);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold flex items-center gap-2"><ShieldAlert className="text-secondary" />Admin Panel</h1>
        <p className="text-muted-foreground text-sm mt-1">Oversight across the entire grid.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { icon: Users, label: "Users", v: stat.users },
          { icon: Gauge, label: "Meters", v: stat.meters },
          { icon: Activity, label: "Recent alerts", v: stat.alerts },
        ].map((s) => (
          <div key={s.label} className="glass rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 border border-secondary/30 flex items-center justify-center">
                <s.icon className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className="font-display text-3xl font-bold">{s.v}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-5">
          <h3 className="font-display font-semibold text-lg mb-4">All Meters</h3>
          <div className="space-y-2 max-h-[400px] overflow-auto">
            {allMeters.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30">
                <div>
                  <p className="font-mono text-sm">{m.meter_number}</p>
                  <p className="text-xs text-muted-foreground">{m.label || "—"}</p>
                </div>
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${
                  m.status === "theft" ? "bg-risk-high/15 text-risk-high" :
                  m.status === "suspicious" ? "bg-risk-mid/15 text-risk-mid" :
                  "bg-risk-low/15 text-risk-low"}`}>{m.status}</span>
              </div>
            ))}
            {allMeters.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No meters registered.</p>}
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="font-display font-semibold text-lg mb-4">Recent Alerts</h3>
          <div className="space-y-2 max-h-[400px] overflow-auto">
            {recentAlerts.map((a) => (
              <div key={a.id} className="p-3 rounded-lg bg-muted/20 border border-border">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <span className="text-[10px] font-mono text-risk-high">risk {Math.round(a.risk_score)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</p>
              </div>
            ))}
            {recentAlerts.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No alerts yet.</p>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
