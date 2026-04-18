// Generates AI-powered energy-saving recommendations from recent meter readings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { meter_id } = await req.json();
    if (!meter_id) {
      return new Response(JSON.stringify({ error: "meter_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader ?? "" } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: readings } = await supabase
      .from("meter_readings")
      .select("voltage,current,power_kwh,recorded_at")
      .eq("meter_id", meter_id)
      .order("recorded_at", { ascending: false })
      .limit(120);

    if (!readings || readings.length < 5) {
      return new Response(JSON.stringify({ tips: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Aggregate by hour-of-day to find peaks
    const byHour: Record<number, number[]> = {};
    for (const r of readings) {
      const h = new Date(r.recorded_at).getHours();
      (byHour[h] ||= []).push(Number(r.power_kwh));
    }
    const hourly = Object.entries(byHour).map(([h, arr]) => ({
      hour: Number(h),
      avg: arr.reduce((s, x) => s + x, 0) / arr.length,
    })).sort((a, b) => b.avg - a.avg);
    const peakHours = hourly.slice(0, 3).map((x) => `${x.hour}:00`).join(", ");
    const totalKwh = readings.reduce((s, r) => s + Number(r.power_kwh), 0).toFixed(2);
    const avgVoltage = (readings.reduce((s, r) => s + Number(r.voltage), 0) / readings.length).toFixed(1);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ tips: [{ title: "Shift heavy loads", body: `Your peak hours are ${peakHours}. Run dishwashers / laundry off-peak.` }] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a residential energy efficiency advisor. Give 3 short, specific, actionable tips based on the meter data. Each tip: ≤18 words. Return tight JSON only." },
          { role: "user", content: `Last 120 readings totals ${totalKwh} kWh. Avg voltage ${avgVoltage}V. Peak consumption hours: ${peakHours}.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "give_tips",
            description: "Return 3 concise energy-saving tips",
            parameters: {
              type: "object",
              properties: {
                tips: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      body: { type: "string" },
                    },
                    required: ["title", "body"],
                  },
                },
              },
              required: ["tips"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "give_tips" } },
      }),
    });

    if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit reached, try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!resp.ok) throw new Error(`AI error ${resp.status}`);

    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { tips: [] };

    return new Response(JSON.stringify({ tips: parsed.tips, peakHours, totalKwh }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("energy-tips error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
