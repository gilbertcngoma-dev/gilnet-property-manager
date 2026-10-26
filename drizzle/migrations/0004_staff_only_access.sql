DROP POLICY IF EXISTS "Open access restaurant" ON public.restaurant_sales;
DROP POLICY IF EXISTS "lodge staff full access rooms" ON public.rooms;
DROP POLICY IF EXISTS "lodge staff full access stays" ON public.stays;
REVOKE ALL ON public.restaurant_sales, public.rooms, public.stays FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_sales, public.rooms, public.stays TO authenticated;
GRANT ALL ON public.restaurant_sales, public.rooms, public.stays TO service_role;
CREATE POLICY "Signed-in staff manage restaurant sales" ON public.restaurant_sales FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Signed-in staff manage rooms" ON public.rooms FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Signed-in staff manage stays" ON public.stays FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);