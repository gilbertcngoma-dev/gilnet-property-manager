CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_no text NOT NULL UNIQUE,
  room_type text NOT NULL DEFAULT 'Standard' CHECK (room_type IN ('Standard','Deluxe','Suite')),
  status text NOT NULL DEFAULT 'Vacant' CHECK (status IN ('Vacant','Occupied','Cleaning')),
  floor int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lodge staff full access rooms" ON public.rooms FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.stays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name text NOT NULL,
  check_in date NOT NULL,
  check_out date NOT NULL,
  room_no text NOT NULL,
  rate_per_night numeric NOT NULL DEFAULT 0,
  laundry_cost numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash','Airtel','Bank')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stays TO anon, authenticated;
GRANT ALL ON public.stays TO service_role;
ALTER TABLE public.stays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lodge staff full access stays" ON public.stays FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.rooms (room_no, room_type, status, floor) VALUES
('101','Standard','Vacant',1),('102','Standard','Vacant',1),('103','Standard','Cleaning',1),('104','Deluxe','Vacant',1),
('201','Standard','Vacant',2),('202','Deluxe','Vacant',2),('203','Deluxe','Vacant',2),('204','Suite','Vacant',2),
('301','Deluxe','Vacant',3),('302','Suite','Vacant',3);