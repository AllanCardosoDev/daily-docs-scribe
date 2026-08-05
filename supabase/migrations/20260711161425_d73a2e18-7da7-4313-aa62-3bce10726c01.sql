REVOKE EXECUTE ON FUNCTION public.is_user_scheduled_on(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_scheduled_on(uuid, date) TO service_role;