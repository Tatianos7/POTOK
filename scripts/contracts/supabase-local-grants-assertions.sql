-- Disposable-only assertions after exact review SQL replay.
DO $$
DECLARE role_name text; rel text; op text; col text;
BEGIN
 FOR role_name IN SELECT unnest(ARRAY['anon','authenticated']) LOOP
  FOR rel IN SELECT unnest(ARRAY['subscriptions','entitlements','billing_events']) LOOP
   FOREACH op IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES'] LOOP
    IF has_table_privilege(role_name,format('public.%I',rel),op) THEN
     RAISE EXCEPTION '% unexpectedly has % on %',role_name,op,rel;
    END IF;
   END LOOP;
  END LOOP;
  IF has_table_privilege(role_name,'public.user_profiles','UPDATE')
     OR has_table_privilege(role_name,'public.user_profiles','INSERT') THEN
   RAISE EXCEPTION '% retains broad profile write',role_name;
  END IF;
  FOR col IN SELECT unnest(ARRAY['has_premium','is_admin']) LOOP
   FOREACH op IN ARRAY ARRAY['INSERT','UPDATE'] LOOP
    IF has_column_privilege(role_name,'public.user_profiles',col,op) THEN
     RAISE EXCEPTION '% can % privileged profile field %',role_name,op,col;
    END IF;
   END LOOP;
  END LOOP;
 END LOOP;
 IF NOT has_column_privilege('authenticated','public.user_profiles','first_name','UPDATE')
    OR NOT has_column_privilege('authenticated','public.user_profiles','coach_settings','UPDATE')
    OR NOT has_column_privilege('authenticated','public.user_profiles','voice_settings','UPDATE')
    OR NOT has_column_privilege('authenticated','public.user_profiles','id_user','INSERT') THEN
  RAISE EXCEPTION 'Ordinary profile write privilege missing';
 END IF;
 RAISE NOTICE 'PASS: effective grants for finance and profile allowlist';
END $$;
