ALTER TABLE public.rooms DROP CONSTRAINT rooms_room_type_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_room_type_check CHECK (room_type IN ('Standard','Twin','Deluxe','Suite'));
UPDATE public.rooms SET room_type = 'Twin' WHERE room_no IN ('04','05','06');