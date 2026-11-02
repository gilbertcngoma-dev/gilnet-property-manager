CREATE TABLE public.lodge_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.lodge_backups TO authenticated;
GRANT ALL ON public.lodge_backups TO service_role;
ALTER TABLE public.lodge_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff save backups" ON public.lodge_backups FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_staff(auth.uid()));
CREATE POLICY "Staff read backups" ON public.lodge_backups FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));