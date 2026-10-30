ALTER TABLE public.stays ADD COLUMN status TEXT NOT NULL DEFAULT 'Confirmed';
ALTER TABLE public.stays ADD CONSTRAINT stays_status_check CHECK (status IN ('Confirmed','Pending','Checked-in'));
INSERT INTO public.stays (guest_name, check_in, check_out, room_no, rate_per_night, laundry_cost, amount_paid, payment_method, status) VALUES
  ('John Banda', '2026-10-29', '2026-11-01', '02', 700, 0, 0, 'Pending', 'Confirmed'),
  ('Sarah Phiri', '2026-10-31', '2026-11-02', '05', 700, 0, 0, 'Pending', 'Pending'),
  ('David Mwale', '2026-10-30', '2026-10-31', '03', 700, 0, 0, 'Pending', 'Checked-in');
UPDATE public.rooms SET status = 'Occupied' WHERE room_no = '03';