import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

const schema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(72),
});

const Auth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/dashboard");
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success("Account created!");
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
        if (error) throw error;
        navigate("/dashboard");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-glow pointer-events-none" />
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md glass rounded-2xl p-8"
      >
        <Link to="/" className="inline-block mb-6"><Logo /></Link>
        <h1 className="font-display text-2xl font-bold">{mode === "signup" ? "Create account" : "Welcome back"}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "signup" ? "Start monitoring your grid in seconds." : "Sign in to your VoltGuard dashboard."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@utility.com" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1.5" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 h-11">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground mt-6">
          {mode === "signup" ? "Already have an account?" : "New to VoltGuard?"}{" "}
          <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="text-primary hover:underline font-medium">
            {mode === "signup" ? "Sign in" : "Create one"}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
