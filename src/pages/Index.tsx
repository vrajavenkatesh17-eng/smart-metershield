import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Activity, Brain, Map, ShieldCheck, Zap, BarChart3, Bell, Lock } from "lucide-react";

const features = [
  { icon: Brain, title: "AI Anomaly Detection", desc: "Hybrid statistical + LLM analysis flags theft signatures, voltage sags, and meter bypasses in real time." },
  { icon: Activity, title: "Live Telemetry", desc: "Stream voltage, current, and kWh from every smart meter with sub-second latency." },
  { icon: Bell, title: "Instant Alerts", desc: "Critical incidents trigger alerts with AI-written explanations and recommended actions." },
  { icon: Map, title: "Grid Map View", desc: "Interactive Mapbox view of every meter, color-coded by risk." },
  { icon: BarChart3, title: "Theft Risk Score", desc: "0–100 score per meter, updated every read — green / yellow / red coding." },
  { icon: Lock, title: "Role-based Access", desc: "Consumer view + admin oversight with row-level security on every table." },
];

const Index = () => {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Aurora background */}
      <div className="absolute inset-0 bg-gradient-glow pointer-events-none" />
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />

      {/* Nav */}
      <header className="relative z-10 container flex items-center justify-between py-6">
        <Logo />
        <div className="flex items-center gap-3">
          <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/auth?mode=signup"><Button className="bg-gradient-primary text-primary-foreground hover:opacity-90 glow-primary">Get started</Button></Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 container pt-16 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-mono text-muted-foreground mb-6"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          AI · Real-time · Edge-native
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl mx-auto leading-[1.05]"
        >
          Detect electricity theft <br />
          <span className="text-gradient">before it costs you.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto"
        >
          VoltGuard streams live data from every smart meter, runs hybrid AI anomaly detection,
          and surfaces theft signatures the moment they happen — with a clear risk score and explainable alerts.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link to="/auth?mode=signup">
            <Button size="lg" className="bg-gradient-primary text-primary-foreground hover:opacity-90 glow-primary px-7 h-12 text-base">
              <Zap className="w-4 h-4 mr-2" /> Launch dashboard
            </Button>
          </Link>
          <Link to="/auth">
            <Button size="lg" variant="outline" className="h-12 px-7 text-base border-border hover:border-primary/50">
              Sign in
            </Button>
          </Link>
        </motion.div>

        {/* Hero device mockup */}
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.8 }}
          className="mt-20 max-w-5xl mx-auto"
        >
          <div className="glass rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-aurora opacity-50" />
            <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { l: "Voltage", v: "230.4", u: "V", c: "primary" },
                { l: "Current", v: "4.82", u: "A", c: "secondary" },
                { l: "Power", v: "1.11", u: "kWh", c: "primary" },
              ].map((m, i) => (
                <div key={i} className="rounded-xl bg-background/40 border border-border p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{m.l}</p>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="font-display text-3xl font-bold">{m.v}</span>
                    <span className="text-xs font-mono text-muted-foreground">{m.u}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="relative mt-4 rounded-xl bg-background/40 border border-border p-4 h-32 overflow-hidden">
              <svg viewBox="0 0 400 100" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,60 C40,40 80,80 120,55 C160,30 200,70 240,50 C280,35 320,65 360,45 L400,55 L400,100 L0,100 Z" fill="url(#hg)" />
                <path d="M0,60 C40,40 80,80 120,55 C160,30 200,70 240,50 C280,35 320,65 360,45 L400,55" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
              </svg>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 container py-20">
        <div className="text-center mb-14">
          <h2 className="font-display text-3xl sm:text-4xl font-bold">Built for modern utilities</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">From IoT ingest to AI inference to operator action — one platform.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="glass glass-hover rounded-2xl p-6"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 container py-10 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
        <Logo size={28} />
        <p>© {new Date().getFullYear()} VoltGuard · AI-powered grid intelligence</p>
      </footer>
    </div>
  );
};

export default Index;
