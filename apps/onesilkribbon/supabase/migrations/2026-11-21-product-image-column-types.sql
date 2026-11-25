-- Existing stores may use jsonb images while the baseline uses text[].
-- Decode through the target row type so both layouts retain their stored data.
begin;

do $migration$
declare
  save_signature regprocedure := 'public.admin_save_product(jsonb,jsonb,jsonb)';
  insert_signature regprocedure := 'public.admin_insert_sku(uuid,text,jsonb)';
  save_definition text := pg_get_functiondef(save_signature);
  insert_definition text := pg_get_functiondef(insert_signature);
  product_source text := 'public.admin_text_array(p_product -> ''images'')';
  sku_source text := 'public.admin_text_array(v_sku -> ''images'')';
  insert_source text := 'public.admin_text_array(p_sku -> ''images'')';
  product_target text := '(jsonb_populate_record(null::public.products, jsonb_build_object(''images'', to_jsonb(' || product_source || ')))).images';
  sku_target text := '(jsonb_populate_record(null::public.product_skus, jsonb_build_object(''images'', to_jsonb(' || sku_source || ')))).images';
  insert_target text := replace(sku_target, sku_source, insert_source);
begin
  -- Remove already migrated expressions before checking and replacing old ones.
  save_definition := replace(replace(save_definition, product_target, product_source), sku_target, sku_source);
  insert_definition := replace(insert_definition, insert_target, insert_source);
  if length(save_definition) - length(replace(save_definition, product_source, '')) <> 2 * length(product_source)
     or length(save_definition) - length(replace(save_definition, sku_source, '')) <> 2 * length(sku_source)
     or length(insert_definition) - length(replace(insert_definition, insert_source, '')) <> length(insert_source) then
    raise exception 'Unexpected product save function definitions; image conversion was not applied';
  end if;

  execute replace(insert_definition, insert_source, insert_target);
  execute replace(replace(save_definition, product_source, product_target), sku_source, sku_target);
end;
$migration$;

commit;
