ALTER TABLE public.stays DROP CONSTRAINT stays_status_check;
ALTER TABLE public.stays ADD CONSTRAINT stays_status_check CHECK (status = ANY (ARRAY['Confirmed','Pending','Checked-in','Cancelled','Later Date']));
ALTER TABLE public.stays ADD COLUMN receipt_no text;