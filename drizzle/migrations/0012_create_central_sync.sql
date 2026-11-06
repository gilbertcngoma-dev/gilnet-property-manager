CREATE TABLE public.central_sync (
  property_code text PRIMARY KEY,
  property_name text NOT NULL DEFAULT '',
  date date NOT NULL DEFAULT CURRENT_DATE,
  total_guests_today integer NOT NULL DEFAULT 0,
  total_sales_today numeric NOT NULL DEFAULT 0,
  cash_collected_today numeric NOT NULL DEFAULT 0,
  rooms_occupied integer NOT NULL DEFAULT 0,
  rooms_available integer NOT NULL DEFAULT 0,
  last_checkin_name text,
  last_checkin_time timestamptz,
  last_sync_at timestamptz NOT NULL DEFAULT now(),
  is_online boolean NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE ON public.central_sync TO authenticated;
GRANT ALL ON public.central_sync TO service_role;
ALTER TABLE public.central_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read lodge statuses" ON public.central_sync FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users add lodge status" ON public.central_sync FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users update lodge status" ON public.central_sync FOR UPDATE TO authenticated USING (true) WITH CHECK (true);