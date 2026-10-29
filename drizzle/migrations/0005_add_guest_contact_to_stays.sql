ALTER TABLE public.stays ADD COLUMN phone text;
ALTER TABLE public.stays ADD COLUMN guest_requests text;
COMMENT ON COLUMN public.stays.phone IS 'Guest contact phone number, captured at check-in.';
COMMENT ON COLUMN public.stays.guest_requests IS 'Special requests or notes from the guest.';