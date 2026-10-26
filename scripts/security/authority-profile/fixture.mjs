import {legacySchema,A,B} from '../catalog-authority/fixture.mjs';
export {A,B};
export const profile=`CREATE TABLE public.user_profiles(id_user uuid PRIMARY KEY,first_name text,last_name text,middle_name text,birth_date date,age integer,height numeric(5,2),goal text,email text,phone text,avatar_url text,has_premium boolean NOT NULL DEFAULT false,is_admin boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),coach_settings jsonb NOT NULL DEFAULT '{}',voice_settings jsonb NOT NULL DEFAULT '{}');
INSERT INTO public.user_profiles(id_user,is_admin,has_premium,coach_settings,voice_settings) VALUES('${A}',true,true,'{"mode":"support"}','{"enabled":false}'),('${B}',false,false,'{}','{}');
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON public.user_profiles FOR SELECT TO authenticated USING(auth.uid()=id_user);
CREATE POLICY owner_insert ON public.user_profiles FOR INSERT TO authenticated WITH CHECK(auth.uid()=id_user);
CREATE POLICY owner_update ON public.user_profiles FOR UPDATE TO authenticated USING(auth.uid()=id_user) WITH CHECK(auth.uid()=id_user);`;
export async function catalogFixture(){let sql=await legacySchema();const a=sql.indexOf('CREATE TABLE public.user_profiles('),b=sql.indexOf('CREATE TABLE public.foods(');return sql.slice(0,a)+profile+'\n'+sql.slice(b);}
