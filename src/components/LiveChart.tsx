import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";

export interface ChartPoint {
  ts: number;
  voltage: number;
  current: number;
  power_kwh: number;
}

export const LiveChart = ({ data }: { data: ChartPoint[] }) => {
  const formatted = data.map((d) => ({ ...d, time: format(new Date(d.ts), "HH:mm:ss") }));
  return (
    <div className="glass rounded-2xl p-5 h-[340px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold text-lg">Live Consumption</h3>
          <p className="text-xs text-muted-foreground font-mono">Real-time stream · last {data.length} readings</p>
        </div>
        <div className="flex gap-3 text-xs font-mono">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" />Power</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-secondary" />Current</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={formatted}>
          <defs>
            <linearGradient id="gradPower" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradCurrent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "12px",
              fontFamily: "JetBrains Mono",
              fontSize: 12,
            }}
          />
          <Area type="monotone" dataKey="power_kwh" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gradPower)" />
          <Area type="monotone" dataKey="current" stroke="hsl(var(--secondary))" strokeWidth={2} fill="url(#gradCurrent)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
