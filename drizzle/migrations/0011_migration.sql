CREATE TABLE IF NOT EXISTS public.property_records (
  id text NOT NULL,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  property_code text NOT NULL,
  table_name text NOT NULL CHECK (table_name IN ('rooms','stays','restaurant_sales')),
  data jsonb,
  deleted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, property_code, table_name, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_records TO authenticated;
GRANT ALL ON public.property_records TO service_role;
ALTER TABLE public.property_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own property records" ON public.property_records FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owners add own property records" ON public.property_records FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners change own property records" ON public.property_records FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners remove own property records" ON public.property_records FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE INDEX IF NOT EXISTS property_records_updated ON public.property_records (owner_id, property_code, updated_at);