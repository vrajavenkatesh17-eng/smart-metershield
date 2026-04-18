// Hybrid anomaly detector: statistical (rolling z-score + spike + zero-current theft signal)
// + Lovable AI explanation for high-risk cases.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Reading {
  voltage: number;
  current: number;
  power_kwh: number;
  recorded_at: string;
}

function statisticalScore(readings: Reading[]): {
  score: number;
  status: "normal" | "suspicious" | "theft";
  reasons: string[];
} {
  if (readings.length < 5) return { score: 5, status: "normal", reasons: ["Not enough data"] };

  const recent = readings.slice(0, 5);
  const baseline = readings.slice(5);
  const reasons: string[] = [];

  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const std = (a: number[], m: number) =>
    Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1));

  const basePow = baseline.map((r) => Number(r.power_kwh));
  const baseVolt = baseline.map((r) => Number(r.voltage));
  const baseCurr = baseline.map((r) => Number(r.current));

  const mP = mean(basePow), sP = Math.max(0.05, std(basePow, mP));
  const mV = mean(baseVolt), sV = Math.max(0.5, std(baseVolt, mV));
  const recentPow = mean(recent.map((r) => Number(r.power_kwh)));
  const recentVolt = mean(recent.map((r) => Number(r.voltage)));
  const recentCurr = mean(recent.map((r) => Number(r.current)));
  const baseCurrMean = mean(baseCurr);

  let score = 10; // 0-100

  // Power spike
  const zPow = (recentPow - mP) / sP;
  if (zPow > 3) { score += 35; reasons.push(`Power spike: +${zPow.toFixed(1)}σ above baseline`); }
  else if (zPow > 2) { score += 20; reasons.push(`Elevated power: +${zPow.toFixed(1)}σ`); }

  // Voltage drop (theft signature: bypass causes voltage sag)
  const zVolt = (recentVolt - mV) / sV;
  if (zVolt < -3) { score += 25; reasons.push(`Voltage sag: ${zVolt.toFixed(1)}σ below normal`); }

  // Current with no proportional power = bypass / hooking
  if (recentCurr > 1 && recentPow < mP * 0.3 && baseCurrMean > 0.5) {
    score += 30;
    reasons.push(`Current flowing without proportional power draw — possible meter bypass`);
  }

  // Sudden zero readings (tampering)
  if (recent.some((r) => Number(r.power_kwh) === 0 && Number(r.current) > 0.3)) {
    score += 20;
    reasons.push(`Non-zero current with zero power reading — meter tampering signal`);
  }

  // Variance burst
  const recentStd = std(recent.map((r) => Number(r.power_kwh)), recentPow);
  if (recentStd > sP * 3) {
    score += 10;
    reasons.push(`Erratic consumption pattern detected`);
  }

  score = Math.min(100, Math.max(0, score));
  const status: "normal" | "suspicious" | "theft" =
    score >= 70 ? "theft" : score >= 40 ? "suspicious" : "normal";
  if (reasons.length === 0) reasons.push("Consumption within expected range");
  return { score, status, reasons };
}

async function aiExplain(readings: Reading[], score: number, reasons: string[]): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return reasons.join(". ");
  try {
    const summary = readings.slice(0, 8).map((r) =>
      `${new Date(r.recorded_at).toISOString().slice(11, 19)} V=${Number(r.voltage).toFixed(1)} I=${Number(r.current).toFixed(2)} P=${Number(r.power_kwh).toFixed(3)}`
    ).join(" | ");
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an electricity grid anomaly analyst. In 2 short sentences, explain to a utility operator what likely caused the anomaly and recommend one action. Be specific and technical but concise." },
          { role: "user", content: `Risk score: ${score}/100. Statistical signals: ${reasons.join("; ")}. Recent readings: ${summary}` },
        ],
      }),
    });
    if (!resp.ok) return reasons.join(". ");
    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() ?? reasons.join(". ");
  } catch {
    return reasons.join(". ");
  }
}

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
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: meter, error: mErr } = await supabase
      .from("meters").select("id,user_id,meter_number").eq("id", meter_id).maybeSingle();
    if (mErr || !meter) {
      return new Response(JSON.stringify({ error: "Meter not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: readings, error: rErr } = await supabase
      .from("meter_readings")
      .select("voltage,current,power_kwh,recorded_at")
      .eq("meter_id", meter_id)
      .order("recorded_at", { ascending: false })
      .limit(50);
    if (rErr) throw rErr;

    const stat = statisticalScore((readings ?? []) as Reading[]);
    let explanation = stat.reasons.join(". ");
    if (stat.status !== "normal") {
      explanation = await aiExplain(readings as Reading[], stat.score, stat.reasons);
    }

    // Persist alert + meter status if non-normal
    if (stat.status !== "normal") {
      await supabase.from("alerts").insert({
        meter_id,
        user_id: meter.user_id,
        severity: stat.status === "theft" ? "critical" : "warning",
        risk_score: stat.score,
        title: stat.status === "theft" ? `Theft detected on ${meter.meter_number}` : `Suspicious activity on ${meter.meter_number}`,
        description: stat.reasons.join("; "),
        ai_explanation: explanation,
      });
    }
    await supabase.from("meters").update({ status: stat.status }).eq("id", meter_id);

    return new Response(JSON.stringify({
      risk_score: stat.score,
      status: stat.status,
      reasons: stat.reasons,
      explanation,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("detect-anomaly error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
