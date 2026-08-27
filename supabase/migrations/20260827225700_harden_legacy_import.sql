ALTER FUNCTION public.carregar(text,text,jsonb) SET search_path TO public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.carregar(text,text,jsonb) FROM PUBLIC, anon, authenticated;
