CREATE OR REPLACE FUNCTION public._build_filters_where(_f jsonb)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  item record;
  allowed_cols text[] := ARRAY[
    'agente_negocio','agente_prim_gestion','agente_ultim_gestion',
    'campana_mkt','campana_inconcert','tipo_llamada','ciudad','categoria_mkt',
    'result_negocio','result_prim_gestion','result_ultim_gestion',
    'prim_resultado_marcadora','bpo','cliente','keyword','email','id_lead','id_llave','es_venta'
  ];
  out_sql text := '';
  arr text[];
  token text;
  normalized text[];
BEGIN
  IF _f IS NULL OR _f = 'null'::jsonb OR _f = '{}'::jsonb THEN
    RETURN '';
  END IF;

  FOR item IN SELECT key, value FROM jsonb_each(_f) LOOP
    IF NOT (item.key = ANY(allowed_cols)) THEN
      CONTINUE;
    END IF;

    IF item.key = 'es_venta' THEN
      IF jsonb_typeof(item.value) = 'boolean' THEN
        out_sql := out_sql || format(' AND es_venta IS NOT DISTINCT FROM %L::boolean', item.value::text);
      ELSIF jsonb_typeof(item.value) = 'string' THEN
        IF item.value #>> '{}' IN ('true','false') THEN
          out_sql := out_sql || format(' AND es_venta IS NOT DISTINCT FROM %L::boolean', item.value #>> '{}');
        END IF;
      END IF;
      CONTINUE;
    END IF;

    normalized := ARRAY[]::text[];

    IF jsonb_typeof(item.value) = 'array' THEN
      arr := ARRAY(SELECT jsonb_array_elements_text(item.value));
    ELSIF jsonb_typeof(item.value) IN ('string','number','boolean') THEN
      arr := ARRAY[item.value #>> '{}'];
    ELSE
      CONTINUE;
    END IF;

    IF coalesce(array_length(arr, 1), 0) = 0 THEN
      CONTINUE;
    END IF;

    FOREACH token IN ARRAY arr LOOP
      IF token IS NULL OR btrim(token) = '' THEN
        CONTINUE;
      END IF;
      normalized := normalized || token;
    END LOOP;

    IF coalesce(array_length(normalized, 1), 0) = 0 THEN
      CONTINUE;
    END IF;

    out_sql := out_sql || ' AND (';
    FOR i IN 1..array_length(normalized, 1) LOOP
      IF i > 1 THEN
        out_sql := out_sql || ' OR ';
      END IF;
      IF normalized[i] = '__vacío__' THEN
        out_sql := out_sql || format('COALESCE(%I, '''') = ''''', item.key);
      ELSE
        out_sql := out_sql || format('COALESCE(%I, '''') = %L', item.key, normalized[i]);
      END IF;
    END LOOP;
    out_sql := out_sql || ')';
  END LOOP;

  RETURN out_sql;
END;
$$;