-- ============================================================
-- Analytics V2.1: Support for Hour granularity
-- ============================================================

CREATE OR REPLACE FUNCTION public.analytics_aggregate(
  p_group_by text[] DEFAULT '{}',
  p_measures jsonb DEFAULT '[]'::jsonb,
  p_filters jsonb DEFAULT '[]'::jsonb,
  p_date_granularity jsonb DEFAULT '{}'::jsonb,
  p_order_by text DEFAULT NULL,
  p_order_dir text DEFAULT 'desc',
  p_limit int DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_select text := '';
  v_group text := '';
  v_where text := 'WHERE 1=1';
  v_order text := '';
  v_sql text;
  v_result jsonb;
  v_field text;
  v_gran text;
  v_m RECORD;
  v_f RECORD;
  v_filter_field text;
  v_filter_values jsonb;
  v_vals_arr text[];
  i int;
  v_alias text;
  v_measures_arr jsonb := COALESCE(p_measures, '[]'::jsonb);
  v_filters_arr jsonb := COALESCE(p_filters, '[]'::jsonb);
BEGIN
  -- Build GROUP BY and SELECT for each group-by field
  IF p_group_by IS NOT NULL AND array_length(p_group_by, 1) > 0 THEN
    FOR i IN 1..array_length(p_group_by, 1) LOOP
      v_field := p_group_by[i];
      v_gran := COALESCE(p_date_granularity, '{}'::jsonb) ->> v_field;

      IF v_gran IS NOT NULL THEN
        -- Date field with granularity
        CASE v_gran
          WHEN 'hour' THEN
            v_select := v_select || format('to_char(%I::timestamp, ''YYYY-MM-DD HH24:00'') AS %I', v_field, v_field);
            v_group := v_group || format('to_char(%I::timestamp, ''YYYY-MM-DD HH24:00'')', v_field);
          WHEN 'day' THEN
            v_select := v_select || format('to_char(%I::date, ''YYYY-MM-DD'') AS %I', v_field, v_field);
            v_group := v_group || format('to_char(%I::date, ''YYYY-MM-DD'')', v_field);
          WHEN 'week' THEN
            v_select := v_select || format('to_char(date_trunc(''week'', %I::date), ''YYYY-"W"IW'') AS %I', v_field, v_field);
            v_group := v_group || format('to_char(date_trunc(''week'', %I::date), ''YYYY-"W"IW'')', v_field);
          WHEN 'month' THEN
            v_select := v_select || format('to_char(%I::date, ''YYYY-MM'') AS %I', v_field, v_field);
            v_group := v_group || format('to_char(%I::date, ''YYYY-MM'')', v_field);
          WHEN 'quarter' THEN
            v_select := v_select || format('to_char(%I::date, ''YYYY-"Q"Q'') AS %I', v_field, v_field);
            v_group := v_group || format('to_char(%I::date, ''YYYY-"Q"Q'')', v_field);
          WHEN 'year' THEN
            v_select := v_select || format('to_char(%I::date, ''YYYY'') AS %I', v_field, v_field);
            v_group := v_group || format('to_char(%I::date, ''YYYY'')', v_field);
          ELSE
            v_select := v_select || format('COALESCE(%I::text, ''(vacío)'') AS %I', v_field, v_field);
            v_group := v_group || format('COALESCE(%I::text, ''(vacío)'')', v_field);
        END CASE;
      ELSE
        -- Regular field
        v_select := v_select || format('COALESCE(%I::text, ''(vacío)'') AS %I', v_field, v_field);
        v_group := v_group || format('COALESCE(%I::text, ''(vacío)'')', v_field);
      END IF;

      IF i < array_length(p_group_by, 1) THEN
        v_select := v_select || ', ';
        v_group := v_group || ', ';
      END IF;
    END LOOP;
  END IF;

  -- Build measures (SELECT aggregations)
  FOR v_m IN SELECT * FROM jsonb_array_elements(v_measures_arr) LOOP
    IF v_select != '' THEN v_select := v_select || ', '; END IF;
    
    v_field := v_m.value->>'field';
    v_alias := COALESCE(v_m.value->>'alias', 'measure_' || COALESCE(v_m.value->>'agg', 'unknown'));

    CASE COALESCE(v_m.value->>'agg', 'count')
      WHEN 'count' THEN
        v_select := v_select || format('COUNT(*)::bigint AS %I', v_alias);
      WHEN 'count_distinct' THEN
        v_select := v_select || format('COUNT(DISTINCT %I)::bigint AS %I', v_field, v_alias);
      WHEN 'sum' THEN
        v_select := v_select || format('COALESCE(SUM(CASE WHEN %I::text ~ ''^[0-9.]+$'' THEN %I::numeric ELSE 0 END), 0)::numeric AS %I', v_field, v_field, v_alias);
      WHEN 'avg' THEN
        v_select := v_select || format('COALESCE(AVG(CASE WHEN %I::text ~ ''^[0-9.]+$'' THEN %I::numeric ELSE NULL END), 0)::numeric AS %I', v_field, v_field, v_alias);
      WHEN 'count_true' THEN
        v_select := v_select || format('COUNT(*) FILTER (WHERE %I = true)::bigint AS %I', v_field, v_alias);
      WHEN 'count_not_null' THEN
        v_select := v_select || format('COUNT(%I)::bigint AS %I', v_field, v_alias);
      ELSE
        v_select := v_select || format('COUNT(*)::bigint AS %I', v_alias);
    END CASE;
  END LOOP;

  -- Default select if empty
  IF v_select = '' THEN v_select := 'COUNT(*) AS total'; END IF;

  -- Build filters (WHERE)
  FOR v_f IN SELECT * FROM jsonb_array_elements(v_filters_arr) LOOP
    v_filter_field := v_f.value->>'field';
    v_filter_values := v_f.value->'values';
    
    IF v_filter_field IS NULL OR v_filter_values IS NULL THEN CONTINUE; END IF;

    IF v_f.value->>'op' = 'eq' AND jsonb_array_length(v_filter_values) = 1 THEN
      v_where := v_where || format(' AND %I::text = %L', v_filter_field, v_filter_values->>0);
    ELSIF v_f.value->>'op' = 'in' OR (v_f.value->>'op' IS NULL AND jsonb_array_length(v_filter_values) > 0) THEN
      SELECT array_agg(val) INTO v_vals_arr FROM jsonb_array_elements_text(v_filter_values) AS val;
      v_where := v_where || format(' AND %I::text = ANY(%L::text[])', v_filter_field, v_vals_arr);
    ELSIF v_f.value->>'op' = 'gte' THEN
      v_where := v_where || format(' AND %I >= %L', v_filter_field, v_filter_values->>0);
    ELSIF v_f.value->>'op' = 'lte' THEN
      v_where := v_where || format(' AND %I <= %L', v_filter_field, v_filter_values->>0);
    ELSIF v_f.value->>'op' = 'between' AND jsonb_array_length(v_filter_values) >= 2 THEN
      v_where := v_where || format(' AND %I >= %L AND %I < (%L::date + interval ''1 day'')', v_filter_field, v_filter_values->>0, v_filter_field, v_filter_values->>1);
    ELSIF v_f.value->>'op' = 'is_true' THEN
      v_where := v_where || format(' AND %I = true', v_filter_field);
    ELSIF v_f.value->>'op' = 'is_false' THEN
      v_where := v_where || format(' AND (%I = false OR %I IS NULL)', v_filter_field, v_filter_field);
    END IF;
  END LOOP;

  -- Build ORDER BY
  IF p_order_by IS NOT NULL AND p_order_by != '' THEN
    v_order := format(' ORDER BY %I %s NULLS LAST', p_order_by, CASE WHEN p_order_dir = 'asc' THEN 'ASC' ELSE 'DESC' END);
  ELSIF v_group != '' OR (p_measures IS NOT NULL AND jsonb_array_length(p_measures) > 0) THEN
    -- Default: order by first measure descending
    v_order := ' ORDER BY ' || (COALESCE(array_length(p_group_by, 1), 0) + 1)::text || ' DESC NULLS LAST';
  ELSE
    v_order := '';
  END IF;

  -- Build final SQL
  v_sql := 'SELECT ' || v_select || ' FROM public.leads ' || v_where;
  IF v_group != '' THEN
    v_sql := v_sql || ' GROUP BY ' || v_group;
  END IF;
  
  IF v_order IS NOT NULL AND v_order != '' THEN
    v_sql := v_sql || v_order;
  END IF;
  
  v_sql := v_sql || format(' LIMIT %s', p_limit);

  EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || v_sql || ') t'
    INTO v_result;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
