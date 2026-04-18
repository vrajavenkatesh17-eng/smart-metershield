// Realistic smart meter reading simulator. Optionally injects anomalies.

export type SimMode = "normal" | "spike" | "bypass" | "tamper";

export interface SimReading {
  voltage: number;
  current: number;
  power_kwh: number;
  ts: number;
}

export function generateReading(mode: SimMode = "normal", base = { v: 230, i: 4.5 }): SimReading {
  let v = base.v + (Math.random() - 0.5) * 4;
  let i = base.i + (Math.random() - 0.5) * 0.6;

  switch (mode) {
    case "spike":
      i = base.i * (3 + Math.random() * 2);
      break;
    case "bypass":
      // current flows but voltage sags & power doesn't match
      v = base.v - 18 - Math.random() * 10;
      i = base.i * (1.4 + Math.random() * 0.4);
      break;
    case "tamper":
      i = base.i * (1 + Math.random() * 0.4);
      v = base.v;
      break;
  }

  let p = (v * i) / 1000; // kW instantaneous
  if (mode === "tamper") p = 0; // meter reports zero despite current
  if (mode === "bypass") p = p * 0.25;

  return {
    voltage: +v.toFixed(2),
    current: +i.toFixed(3),
    power_kwh: +p.toFixed(4),
    ts: Date.now(),
  };
}

export function seedHistorical(count = 40): SimReading[] {
  const out: SimReading[] = [];
  const now = Date.now();
  for (let k = count; k > 0; k--) {
    const r = generateReading("normal");
    out.push({ ...r, ts: now - k * 60_000 });
  }
  return out;
}
