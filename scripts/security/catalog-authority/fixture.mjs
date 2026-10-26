import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
export const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
export const FOOD='33333333-3333-4333-8333-333333333333',REVIEW='44444444-4444-4444-8444-444444444444',DRAFT='55555555-5555-4555-8555-555555555555';
export const EVENT='66666666-6666-4666-8666-666666666666',MISSING='77777777-7777-4777-8777-777777777777',GRANT='88888888-8888-4888-8888-888888888888';
export async function legacySchema(){
 let sql=`CREATE FUNCTION public.normalize_food_text(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lower(btrim(value)) $$;
 CREATE TABLE public.user_profiles(id_user uuid PRIMARY KEY,user_id uuid UNIQUE,is_admin boolean NOT NULL DEFAULT false);
 INSERT INTO public.user_profiles VALUES('${A}','${A}',true),('${B}','${B}',false);
 ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;CREATE POLICY own_profile ON public.user_profiles FOR ALL TO authenticated USING(id_user=auth.uid()) WITH CHECK(id_user=auth.uid());
 CREATE TABLE public.foods(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,name_original text,barcode text,brand text,
 calories numeric DEFAULT 0,protein numeric DEFAULT 0,fat numeric DEFAULT 0,carbs numeric DEFAULT 0,fiber numeric,
 unit text DEFAULT 'g',category text,source text NOT NULL DEFAULT 'user',created_by_user_id uuid,canonical_food_id uuid,
 normalized_name text,normalized_brand text,nutrition_version integer DEFAULT 1,verified boolean DEFAULT false,suspicious boolean DEFAULT false,
 confidence_score numeric,source_version text,allergens text[],intolerances text[],aliases text[],auto_filled boolean,popularity integer DEFAULT 0);
 CREATE UNIQUE INDEX food_fixture_name_unique ON public.foods(normalized_name,coalesce(normalized_brand,''));
 CREATE TABLE public.food_aliases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),canonical_food_id uuid REFERENCES public.foods(id),alias text NOT NULL,
 normalized_alias text GENERATED ALWAYS AS (public.normalize_food_text(alias)) STORED UNIQUE,source text NOT NULL DEFAULT 'user',verified boolean DEFAULT false,created_by_user_id uuid);
 CREATE TABLE public.food_diary_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,canonical_food_id uuid,weight numeric,
 calories numeric,protein numeric,fat numeric,carbs numeric,fiber numeric,snapshot jsonb);
 CREATE TABLE public.favorite_products(id integer PRIMARY KEY,canonical_food_id uuid);INSERT INTO public.favorite_products VALUES(1,'${FOOD}');
 CREATE TABLE public.recipe_ingredients(id integer PRIMARY KEY,food_id uuid);INSERT INTO public.recipe_ingredients VALUES(1,'${FOOD}');
 ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;ALTER TABLE public.food_aliases ENABLE ROW LEVEL SECURITY;ALTER TABLE public.food_diary_entries ENABLE ROW LEVEL SECURITY;
 CREATE POLICY food_catalog ON public.foods FOR SELECT TO authenticated USING(source IN('core','brand'));
 CREATE POLICY food_own_read ON public.foods FOR SELECT TO authenticated USING(created_by_user_id=auth.uid());
 CREATE POLICY food_own_insert ON public.foods FOR INSERT TO authenticated WITH CHECK(created_by_user_id=auth.uid());
 CREATE POLICY food_own_update ON public.foods FOR UPDATE TO authenticated USING(created_by_user_id=auth.uid()) WITH CHECK(created_by_user_id=auth.uid());
 CREATE POLICY food_own_delete ON public.foods FOR DELETE TO authenticated USING(created_by_user_id=auth.uid());
 CREATE POLICY alias_catalog ON public.food_aliases FOR SELECT TO authenticated USING(EXISTS(SELECT FROM public.foods f WHERE f.id=food_aliases.canonical_food_id AND f.source IN('core','brand')));
 CREATE POLICY alias_own ON public.food_aliases FOR ALL TO authenticated USING(created_by_user_id=auth.uid()) WITH CHECK(created_by_user_id=auth.uid());
 CREATE POLICY diary_own ON public.food_diary_entries FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
 INSERT INTO public.foods(id,name,source,canonical_food_id,normalized_name,calories,protein,fat,carbs,fiber)
 VALUES('${FOOD}','Fixture apple','core','${FOOD}','fixture apple',100,3,2,20,4);
 INSERT INTO public.food_diary_entries(user_id,canonical_food_id,weight,calories,protein,fat,carbs,fiber,snapshot)
 VALUES('${A}','${FOOD}',100,17,1,2,3,NULL,'{"history":"A","fiber":null}'),('${B}','${FOOD}',50,29,4,5,6,7,'{"history":"B"}');
 `;
 for(const name of ['20260801_search_analytics_admin_review_draft.sql','20260802_admin_approved_alias_apply_draft.sql','20260805_missing_food_review_queue_draft.sql','20260808_missing_food_drafts_draft.sql','20260809_owner_apply_missing_food_draft_draft.sql'])
   sql+=await readFile('supabase/migration_drafts/'+name,'utf8');
 const ingestion=await readFile('supabase/food_ingestion_schema.sql','utf8');
 const recompute=ingestion.match(/create or replace function public\.recompute_food_entries_for_food_ids\([\s\S]*?\$\$ language plpgsql security definer;/i)?.[0];assert(recompute);sql+=recompute;
 sql+=`GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated,service_role;
 INSERT INTO public.food_search_events(id,user_id,query,normalized_query,context,event_type) VALUES('${EVENT}','${B}','Fixture alias','fixture alias','diary','query');
 INSERT INTO public.food_search_review_queue(id,query,normalized_query,suggested_canonical_food_id,status,reviewer_id,reviewed_at,source_event_ids)
 VALUES('${REVIEW}','Fixture alias','fixture alias','${FOOD}','approved','${B}',now(),ARRAY['${EVENT}'::uuid]);
 INSERT INTO public.food_missing_review_queue(id,query,normalized_query,classification,status,suggested_name,source_event_ids,reviewer_id,reviewed_at)
 VALUES('${MISSING}','New fixture food','new fixture food','missing_canonical_food','approved_for_food_draft','New fixture food',ARRAY['${EVENT}'::uuid],'${B}',now());
 INSERT INTO public.food_missing_food_drafts(id,source_review_id,query,normalized_query,name,normalized_name,category,calories,protein,fat,carbs,fiber,data_source,status,prepared_by,prepared_at,reviewed_by,reviewed_at)
 VALUES('${DRAFT}','${MISSING}','New fixture food','new fixture food','New fixture food','new fixture food','fixture',200,10,5,30,NULL,'synthetic test evidence','ready_for_owner_apply','${B}',now(),'${B}',now());`;
 return sql;
}
export async function verifiedReaders(){
 let sql=`CREATE TABLE potok_control.access_attestations(attestation_id uuid PRIMARY KEY,account_id uuid,capability text,effect text,previous_attestation_id uuid,lineage_sequence bigint,issued_at timestamptz,valid_until timestamptz);
 ALTER TABLE potok_control.access_attestations ENABLE ROW LEVEL SECURITY;
 REVOKE ALL ON SCHEMA potok_control FROM PUBLIC,anon,authenticated,service_role;
 REVOKE ALL ON potok_control.access_attestations FROM PUBLIC,anon,authenticated,service_role;`;
 const source=await readFile('docs/premium/drafts/20260921_trusted_entitlement_v2.sql','utf8');
 for(const name of ['potok_control.is_effective_entitlement_v2','public.has_verified_entitlement_v2','public.has_verified_entitlement_v1']){
   const start=source.indexOf('CREATE FUNCTION '+name+'(');assert(start>=0);const end=source.indexOf('\n$function$;',start);assert(end>start);sql+=source.slice(start,end+'\n$function$;'.length);
 }
 sql+=`REVOKE ALL ON FUNCTION potok_control.is_effective_entitlement_v2(uuid,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
 REVOKE ALL ON FUNCTION public.has_verified_entitlement_v1(text),public.has_verified_entitlement_v2(text) FROM PUBLIC,anon,service_role;
 GRANT EXECUTE ON FUNCTION public.has_verified_entitlement_v1(text),public.has_verified_entitlement_v2(text) TO authenticated;
 INSERT INTO potok_control.access_attestations VALUES('${GRANT}','${B}','admin','GRANT',NULL,1,now()-interval '1 day',now()+interval '1 day');`;
 return sql;
}
