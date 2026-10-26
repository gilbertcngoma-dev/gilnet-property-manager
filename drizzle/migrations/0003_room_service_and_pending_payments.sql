ALTER TABLE public.restaurant_sales ADD COLUMN service_type text NOT NULL DEFAULT 'Restaurant' CHECK (service_type IN ('Restaurant', 'Room service'));
ALTER TABLE public.stays DROP CONSTRAINT stays_payment_method_check;
ALTER TABLE public.stays ADD CONSTRAINT stays_payment_method_check CHECK (payment_method IN ('Cash', 'Mobile', 'Visa/Card', 'Compliment', 'Pending', 'Airtel', 'Bank'));