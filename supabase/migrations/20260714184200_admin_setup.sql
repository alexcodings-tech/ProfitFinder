-- Update grant_admin_for_zhar function to support admin12@gmail.com and bypass email confirmation check
CREATE OR REPLACE FUNCTION public.grant_admin_for_zhar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'info@zhar.in' OR lower(NEW.email) = 'admin12@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Grant admin role to any existing admin12@gmail.com user
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE lower(email) = 'admin12@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
