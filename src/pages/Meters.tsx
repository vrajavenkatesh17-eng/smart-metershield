import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Gauge, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface Meter {
  id: string;
  meter_number: string;
  label: string | null;
  address: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
}

const statusColor = (s: string) =>
  s === "theft" ? "text-risk-high border-risk-high/40 bg-risk-high/10"
  : s === "suspicious" ? "text-risk-mid border-risk-mid/40 bg-risk-mid/10"
  : "text-risk-low border-risk-low/40 bg-risk-low/10";

export default function Meters() {
  const [meters, setMeters] = useState<Meter[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ meter_number: "", label: "", address: "", latitude: "", longitude: "" });

  const load = async () => {
    const { data } = await supabase.from("meters").select("*").order("created_at", { ascending: false });
    setMeters((data ?? []) as Meter[]);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.meter_number.trim()) return toast.error("Meter number required");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("meters").insert({
      user_id: user.id,
      meter_number: form.meter_number.trim(),
      label: form.label || null,
      address: form.address || null,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Meter registered");
    setOpen(false);
    setForm({ meter_number: "", label: "", address: "", latitude: "", longitude: "" });
    load();
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Smart Meters</h1>
          <p className="text-muted-foreground text-sm mt-1">Register and monitor your meter boxes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90"><Plus className="w-4 h-4 mr-2" />Add Meter</Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader><DialogTitle>Register Smart Meter</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Meter Number *</Label><Input value={form.meter_number} onChange={(e) => setForm({ ...form, meter_number: e.target.value })} placeholder="MTR-00123" /></div>
              <div><Label>Label</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Home / Shop A" /></div>
              <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Latitude</Label><Input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="13.0827" /></div>
                <div><Label>Longitude</Label><Input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="80.2707" /></div>
              </div>
              <Button onClick={create} className="w-full bg-gradient-primary text-primary-foreground">Register</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {meters.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Gauge className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No meters yet. Register your first to start monitoring.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {meters.map((m, i) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link to={`/dashboard?meter=${m.id}`}>
                <div className="glass glass-hover rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{m.meter_number}</p>
                      <h3 className="font-display font-semibold text-lg mt-0.5">{m.label || "Untitled meter"}</h3>
                    </div>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${statusColor(m.status)}`}>{m.status}</span>
                  </div>
                  {m.address && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{m.address}</p>}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
