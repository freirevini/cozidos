-- Add unique constraint to email column in profiles table
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_email_key UNIQUE (email);

-- Create index for better performance on email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);