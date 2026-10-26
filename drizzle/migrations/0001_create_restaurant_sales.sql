CREATE TABLE public.restaurant_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_date date NOT NULL DEFAULT current_date,
  item text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  room_no text,
  payment_method text NOT NULL DEFAULT 'Cash',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_sales TO anon, authenticated;
GRANT ALL ON public.restaurant_sales TO service_role;
ALTER TABLE public.restaurant_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access restaurant" ON public.restaurant_sales FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);