import { Link, NavLink, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { LayoutDashboard, AlertTriangle, Map, ShieldCheck, LogOut, Gauge, BarChart3 } from "lucide-react";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const nav = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/meters", icon: Gauge, label: "Meters" },
  { to: "/consumption", icon: BarChart3, label: "Consumption" },
  { to: "/alerts", icon: AlertTriangle, label: "Alerts" },
  { to: "/map", icon: Map, label: "Grid Map" },
];

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/auth");
      setEmail(user.email ?? "");
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setIsAdmin(!!data?.some((r) => r.role === "admin"));
    })();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card/50 backdrop-blur-xl p-5 sticky top-0 h-screen">
        <Link to="/dashboard"><Logo /></Link>
        <nav className="mt-10 flex flex-col gap-1 flex-1">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/30 glow-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mt-3",
                  isActive
                    ? "bg-secondary/10 text-secondary border border-secondary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )
              }
            >
              <ShieldCheck className="w-4 h-4" />
              Admin Panel
            </NavLink>
          )}
        </nav>
        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground truncate mb-2">{email}</p>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 glass border-b border-border px-4 py-3 flex items-center justify-between">
        <Link to="/dashboard"><Logo size={28} /></Link>
        <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="w-4 h-4" /></Button>
      </div>

      <main className="flex-1 min-w-0 pt-16 lg:pt-0">
        {/* Mobile bottom nav */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-border flex justify-around py-2">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) =>
              cn("flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md text-[10px]",
                isActive ? "text-primary" : "text-muted-foreground")}>
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </div>
        <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">{children}</div>
      </main>
    </div>
  );
};
