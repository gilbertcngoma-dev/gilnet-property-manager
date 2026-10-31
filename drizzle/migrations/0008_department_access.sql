CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

DROP POLICY IF EXISTS "Approved staff manage stays" ON public.stays;
CREATE POLICY "Front office manage stays" ON public.stays FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','staff']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','staff']::public.app_role[]));
CREATE POLICY "Housekeeping read stays" ON public.stays FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'housekeeping'));

DROP POLICY IF EXISTS "Approved staff manage rooms" ON public.rooms;
CREATE POLICY "Front office and housekeeping manage rooms" ON public.rooms FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','staff','housekeeping']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','staff','housekeeping']::public.app_role[]));

DROP POLICY IF EXISTS "Approved staff manage restaurant sales" ON public.restaurant_sales;
CREATE POLICY "Front office and restaurant manage sales" ON public.restaurant_sales FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','staff','restaurant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','staff','restaurant']::public.app_role[]));