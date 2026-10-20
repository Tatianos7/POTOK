-- DRAFT / DISPOSABLE P5-02 WIRE PROBE ONLY.
-- Run only in a throwaway PostgreSQL database. Target repair and native
-- serialization are verified by separate acceptance layers.

CREATE ROLE anon NOLOGIN;

CREATE SEQUENCE public.p5_02_probe_invocations;
CREATE TABLE public.p5_02_probe_effects (
  operation_id uuid PRIMARY KEY,
  mode text NOT NULL
);
CREATE TABLE public.p5_02_probe_receipts (
  operation_id uuid PRIMARY KEY,
  outcome text NOT NULL
);

CREATE FUNCTION public.p5_02_error_contract_probe(mode text, operation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM nextval('public.p5_02_probe_invocations');
  INSERT INTO public.p5_02_probe_effects VALUES (operation_id, mode);

  IF mode = 'business_conflict' THEN
    RAISE SQLSTATE 'PT409'
      USING MESSAGE = 'stale adaptive plan revision',
            DETAIL = 'POTOK_ADAPTIVE_NUTRITION_CONFLICT_V1';
  ELSIF mode = 'server_integrity' THEN
    RAISE SQLSTATE 'PT500'
      USING MESSAGE = 'operation result is unresolved',
            DETAIL = 'POTOK_ADAPTIVE_NUTRITION_INVARIANT_FAILURE_V1';
  ELSIF mode <> 'accepted' THEN
    RAISE EXCEPTION 'unsupported fixture mode' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.p5_02_probe_receipts VALUES (operation_id, 'accepted');
  RETURN jsonb_build_object(
    'kind', 'settled',
    'operation_id', operation_id,
    'outcome', 'accepted'
  );
END
$function$;

GRANT USAGE ON SCHEMA public TO anon;
GRANT EXECUTE ON FUNCTION public.p5_02_error_contract_probe(text, uuid) TO anon;
GRANT USAGE ON SEQUENCE public.p5_02_probe_invocations TO anon;
GRANT INSERT ON public.p5_02_probe_effects, public.p5_02_probe_receipts TO anon;

-- Native PostgreSQL assertions. Sequence increments survive rollback and expose
-- any hidden repeat, while effects and receipts must roll back with each error.
DO $native$
DECLARE
  v_state text;
  v_detail text;
  v_last bigint;
  v_called boolean;
BEGIN
  INSERT INTO public.p5_02_probe_receipts VALUES (
    '00000000-0000-4000-8000-000000000099', 'prior_accepted'
  );
  PERFORM setval('public.p5_02_probe_invocations', 1, false);
  BEGIN
    PERFORM public.p5_02_error_contract_probe(
      'business_conflict', '00000000-0000-4000-8000-000000000001'
    );
    RAISE EXCEPTION 'business conflict did not raise';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_detail = PG_EXCEPTION_DETAIL;
    IF v_state <> 'PT409' OR v_detail <> 'POTOK_ADAPTIVE_NUTRITION_CONFLICT_V1' THEN
      RAISE EXCEPTION 'business contract mismatch: state=%, detail=%', v_state, v_detail;
    END IF;
  END;
  SELECT last_value, is_called INTO v_last, v_called FROM public.p5_02_probe_invocations;
  IF v_last <> 1 OR NOT v_called THEN RAISE EXCEPTION 'business call count mismatch'; END IF;
  IF EXISTS (SELECT FROM public.p5_02_probe_effects)
      OR (SELECT count(*) FROM public.p5_02_probe_receipts) <> 1
      OR NOT EXISTS (
        SELECT FROM public.p5_02_probe_receipts
        WHERE operation_id = '00000000-0000-4000-8000-000000000099'
          AND outcome = 'prior_accepted'
      ) THEN
    RAISE EXCEPTION 'business error did not roll back new effects or preserve prior receipt';
  END IF;

  TRUNCATE public.p5_02_probe_effects, public.p5_02_probe_receipts;
  PERFORM setval('public.p5_02_probe_invocations', 1, false);
  BEGIN
    PERFORM public.p5_02_error_contract_probe(
      'server_integrity', '00000000-0000-4000-8000-000000000002'
    );
    RAISE EXCEPTION 'server integrity did not raise';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_detail = PG_EXCEPTION_DETAIL;
    IF v_state <> 'PT500' OR v_detail <> 'POTOK_ADAPTIVE_NUTRITION_INVARIANT_FAILURE_V1' THEN
      RAISE EXCEPTION 'integrity contract mismatch: state=%, detail=%', v_state, v_detail;
    END IF;
  END;

  PERFORM public.p5_02_error_contract_probe(
    'accepted', '00000000-0000-4000-8000-000000000004'
  );
  IF NOT EXISTS (
    SELECT FROM public.p5_02_probe_receipts
    WHERE operation_id = '00000000-0000-4000-8000-000000000004'
      AND outcome = 'accepted'
  ) THEN
    RAISE EXCEPTION 'accepted receipt missing';
  END IF;
END
$native$;
