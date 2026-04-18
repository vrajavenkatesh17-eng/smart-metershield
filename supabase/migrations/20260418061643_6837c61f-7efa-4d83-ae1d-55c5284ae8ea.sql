-- Roles enum + table (separate from profiles to prevent privilege escalation)
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Smart meters
CREATE TABLE public.meters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meter_number TEXT NOT NULL UNIQUE,
  label TEXT,
  address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  status TEXT NOT NULL DEFAULT 'normal', -- normal | suspicious | theft
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meters ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_meters_user ON public.meters(user_id);

-- Readings (time series)
CREATE TABLE public.meter_readings (
  id BIGSERIAL PRIMARY KEY,
  meter_id UUID NOT NULL REFERENCES public.meters(id) ON DELETE CASCADE,
  voltage NUMERIC NOT NULL,
  current NUMERIC NOT NULL,
  power_kwh NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_readings_meter_time ON public.meter_readings(meter_id, recorded_at DESC);

-- Alerts
CREATE TABLE public.alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meter_id UUID NOT NULL REFERENCES public.meters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  severity TEXT NOT NULL, -- info | warning | critical
  status TEXT NOT NULL DEFAULT 'open', -- open | flagged | dismissed | confirmed
  risk_score NUMERIC NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  ai_explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_alerts_user ON public.alerts(user_id, created_at DESC);
CREATE INDEX idx_alerts_meter ON public.alerts(meter_id, created_at DESC);

-- updated_at trigger fn
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_meters_updated BEFORE UPDATE ON public.meters
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + default user role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS POLICIES --

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- user_roles (read-only for users; admins manage)
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- meters
CREATE POLICY "Users view own meters" ON public.meters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all meters" ON public.meters FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own meters" ON public.meters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own meters" ON public.meters FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins update meters" ON public.meters FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users delete own meters" ON public.meters FOR DELETE USING (auth.uid() = user_id);

-- readings
CREATE POLICY "Users view own readings" ON public.meter_readings FOR SELECT
USING (EXISTS (SELECT 1 FROM public.meters m WHERE m.id = meter_id AND m.user_id = auth.uid()));
CREATE POLICY "Admins view all readings" ON public.meter_readings FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert readings on own meters" ON public.meter_readings FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.meters m WHERE m.id = meter_id AND m.user_id = auth.uid()));

-- alerts
CREATE POLICY "Users view own alerts" ON public.alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all alerts" ON public.alerts FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own alerts" ON public.alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own alerts" ON public.alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins update alerts" ON public.alerts FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Realtime
ALTER TABLE public.meter_readings REPLICA IDENTITY FULL;
ALTER TABLE public.alerts REPLICA IDENTITY FULL;
ALTER TABLE public.meters REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meter_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meters;