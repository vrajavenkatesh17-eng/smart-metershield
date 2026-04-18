import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Key } from "lucide-react";

interface Meter { id: string; meter_number: string; label: string | null; latitude: number | null; longitude: number | null; status: string; }

const TOKEN_KEY = "voltguard_mapbox_token";

export default function GridMap() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) ?? "");
  const [savedToken, setSavedToken] = useState(localStorage.getItem(TOKEN_KEY) ?? "");
  const [meters, setMeters] = useState<Meter[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("meters").select("id,meter_number,label,latitude,longitude,status");
      setMeters(((data ?? []) as Meter[]).filter((m) => m.latitude && m.longitude));
    })();
  }, []);

  useEffect(() => {
    if (!savedToken || !ref.current || mapRef.current) return;
    mapboxgl.accessToken = savedToken;
    try {
      const center: [number, number] = meters[0]?.longitude && meters[0]?.latitude
        ? [Number(meters[0].longitude), Number(meters[0].latitude)]
        : [80.2707, 13.0827];
      mapRef.current = new mapboxgl.Map({
        container: ref.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center,
        zoom: 11,
      });
      mapRef.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current.on("load", () => {
        meters.forEach((m) => {
          const color = m.status === "theft" ? "#f43f5e" : m.status === "suspicious" ? "#facc15" : "#22d3a0";
          const el = document.createElement("div");
          el.style.cssText = `width:18px;height:18px;border-radius:50%;background:${color};box-shadow:0 0 0 4px ${color}33,0 0 16px ${color}aa;border:2px solid #0a0e1a;cursor:pointer;`;
          new mapboxgl.Marker(el)
            .setLngLat([Number(m.longitude!), Number(m.latitude!)])
            .setPopup(new mapboxgl.Popup({ offset: 14 }).setHTML(`<div style="color:#0a0e1a;font-family:DM Sans;"><strong>${m.meter_number}</strong><br/>${m.label ?? ""}<br/><em>Status: ${m.status}</em></div>`))
            .addTo(mapRef.current!);
        });
      });
    } catch (e) {
      toast.error("Invalid Mapbox token");
    }
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, [savedToken, meters]);

  const save = () => {
    if (!token.startsWith("pk.")) return toast.error("Use a public Mapbox token (pk.…)");
    localStorage.setItem(TOKEN_KEY, token);
    setSavedToken(token);
    toast.success("Token saved");
  };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Grid Map</h1>
        <p className="text-muted-foreground text-sm mt-1">Geographic view of every registered meter, color-coded by risk.</p>
      </div>

      {!savedToken && (
        <div className="glass rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Key className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Mapbox token required</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Get a free public token at <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noreferrer" className="text-primary underline">mapbox.com</a>. It's stored locally in your browser.
          </p>
          <div className="flex gap-2">
            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="pk.eyJ1Ijoi…" className="font-mono text-xs" />
            <Button onClick={save} className="bg-gradient-primary text-primary-foreground">Save</Button>
          </div>
        </div>
      )}

      <div ref={ref} className="glass rounded-2xl overflow-hidden h-[600px] w-full" />
      {savedToken && meters.length === 0 && (
        <p className="text-sm text-muted-foreground mt-4 text-center">Add latitude/longitude to your meters to see them on the map.</p>
      )}
    </AppShell>
  );
}
