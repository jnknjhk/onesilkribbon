-- One-time catalog cutover for the existing Fine Silk Ribbons product.
-- Deploy the storefront's fine_silk_ribbon_colours support before executing.
do $migration$
declare
  source_product public.products%rowtype;
  colour_options jsonb;
  options_without_colour jsonb;
  product_specs jsonb;
  colour_option record;
  colour_name text;
  colour_image text;
  colour_products jsonb := '{}'::jsonb;
  target_id uuid;
  moved_count integer;
begin
  perform set_config('lock_timeout', '5s', true);
  select * into strict source_product from public.products
    where slug = '2mm-mulberry-silk-ribbon' and collection = 'fine-silk-ribbons'
    for update;

  if exists (select 1 from public.settings where key = 'fine_silk_ribbon_colours') then
    raise exception 'Fine Silk Ribbons has already been split';
  end if;
  if source_product.is_active is distinct from true then
    raise exception 'The source Fine Silk Ribbons product must be active';
  end if;

  perform id from public.product_skus where product_id = source_product.id order by id for update;

  select option_group->'options' into strict colour_options
    from jsonb_array_elements(source_product.attribute_config) as option_group
    where option_group->>'name' = 'COLOR';
  select jsonb_agg(option_group order by position) into options_without_colour
    from jsonb_array_elements(source_product.attribute_config) with ordinality as config(option_group, position)
    where option_group->>'name' <> 'COLOR';

  if jsonb_array_length(colour_options) is distinct from 29
    or (select count(*) from public.product_skus where product_id = source_product.id) <> 145
    or (select count(distinct value->>'image') from jsonb_array_elements(colour_options)) <> 29
    or not exists (select 1 from jsonb_array_elements(source_product.specifications) as spec
      where spec->>'key' = 'Length' and spec->>'value' = '10m per spool') then
    raise exception 'Source colours, images, SKU count or fixed spool length changed since preflight';
  end if;

  select jsonb_agg(case when spec->>'key' = 'Width'
      then jsonb_set(spec, '{value}', to_jsonb('2mm, 4mm, 7mm, 10mm, 13mm'::text)) else spec end order by position)
    into product_specs
    from jsonb_array_elements(source_product.specifications) with ordinality as specs(spec, position)
    where spec <> '{"key":"1","value":"1"}'::jsonb;

  for colour_option in select value, position from jsonb_array_elements(colour_options) with ordinality as colours(value, position) loop
    colour_name := btrim(colour_option.value->>'value');
    colour_image := colour_option.value->>'image';
    if colour_name is null or colour_name !~ '^[A-Za-z0-9]+([ -][A-Za-z0-9]+)*$'
      or colour_image is null or colour_image !~ '^https://' then
      raise exception 'Invalid name or image for Fine Silk Ribbons colour %', colour_name;
    end if;

    if (select array_agg(attributes->>'WIDTH' order by attributes->>'WIDTH')
        from public.product_skus
        where product_id = source_product.id and attributes->>'COLOR' = colour_option.value->>'value'
          and is_active = true and price_gbp > 0 and width_mm is null and length_m is null
          and colour = '默认') is distinct from array['10mm', '13mm', '2mm', '4mm', '7mm'] then
      raise exception 'Source SKU options for % changed since preflight', colour_name;
    end if;

    insert into public.products (
      name, slug, description, care_instructions, collection, is_active, is_featured,
      images, sort_order, attribute_config, specifications
    ) values (
      colour_name || ' Ultra-Fine Mulberry Silk Ribbon',
      'mulberry-silk-ribbon-' || regexp_replace(lower(colour_name), '[ -]+', '-', 'g'),
      colour_name || ' ultra-fine mulberry silk ribbon is supplied on a 10 metre spool, with five widths from 2mm to 13mm.' || E'\n\n' ||
      replace(regexp_replace(source_product.description, E'\n✦ Color Inspiration\n.*\n✦ Applications', E'\n✦ Applications'),
        E'\nWidth: 2mm\n', E'\nWidths: 2mm, 4mm, 7mm, 10mm and 13mm\n'),
      source_product.care_instructions, source_product.collection, true, source_product.is_featured,
      array[colour_image], coalesce(source_product.sort_order, 0) + colour_option.position - 1,
      options_without_colour, product_specs
    ) returning id into target_id;

    update public.product_skus set
      product_id = target_id,
      colour = colour_name,
      width_mm = left(attributes->>'WIDTH', -2)::integer,
      length_m = 10,
      attributes = attributes - 'COLOR'
    where product_id = source_product.id and attributes->>'COLOR' = colour_option.value->>'value';
    get diagnostics moved_count = row_count;
    if moved_count <> 5 then
      raise exception 'Unexpected SKU count for %', colour_name;
    end if;
    colour_products := colour_products || jsonb_build_object(target_id::text, colour_name);
  end loop;

  if exists (select 1 from public.product_skus where product_id = source_product.id) then
    raise exception 'Some source SKUs were not moved';
  end if;

  update public.products set is_active = false, updated_at = now() where id = source_product.id;
  insert into public.settings (key, value) values ('fine_silk_ribbon_colours', jsonb_build_object(
    'id', source_product.id, 'name', source_product.name, 'colours', colour_products
  )::text);
end
$migration$;
