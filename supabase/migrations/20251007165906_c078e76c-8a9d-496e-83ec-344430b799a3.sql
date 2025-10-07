-- Make profiles.id auto-generate when not provided
ALTER TABLE public.profiles 
ALTER COLUMN id SET DEFAULT gen_random_uuid();