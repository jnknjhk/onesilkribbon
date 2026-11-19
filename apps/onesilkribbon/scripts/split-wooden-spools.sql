-- Deploy the wooden_spool_sizes storefront support before this one-time cutover.
do $migration$
declare
  source_product public.products%rowtype;
  size_options jsonb;
  finish_config jsonb;
  size_option record;
  size_value text;
  size_label text;
  size_image text;
  size_products jsonb := '{}'::jsonb;
  target_id uuid;
  moved_count integer;
begin
  perform set_config('lock_timeout', '5s', true);
  select * into strict source_product from public.products
    where slug = 'artisan-wooden-spools' and collection = 'studio-tools' for update;

  if exists (select 1 from public.settings where key = 'wooden_spool_sizes') then
    raise exception 'Wooden spools have already been split';
  end if;
  if source_product.is_active is distinct from true then
    raise exception 'The source wooden spool product must be active';
  end if;

  perform id from public.product_skus where product_id = source_product.id order by id for update;

  select option_group->'options' into strict size_options
    from jsonb_array_elements(source_product.attribute_config) as option_group
    where option_group->>'name' = 'Size';
  select option_group into strict finish_config
    from jsonb_array_elements(source_product.attribute_config) as option_group
    where option_group->>'name' = 'COLOR';

  if jsonb_array_length(source_product.attribute_config) <> 2
    or jsonb_array_length(size_options) is distinct from 11
    or (select count(distinct value->>'image') from jsonb_array_elements(size_options)) <> 11
    or (select array_agg(value->>'value' order by value->>'value') from jsonb_array_elements(finish_config->'options'))
      is distinct from array['Espresso', 'Original Wood']
    or (select count(*) from public.product_skus where product_id = source_product.id) <> 22 then
    raise exception 'Source sizes, finishes, images or SKU count changed since preflight';
  end if;

  for size_option in select value, position from jsonb_array_elements(size_options) with ordinality as options(value, position) loop
    size_value := size_option.value->>'value';
    size_image := size_option.value->>'image';
    if size_value is null or size_value !~ '^[0-9]+(\.[0-9]+)?cm\*[0-9]+(\.[0-9]+)?cm$'
      or size_image is null or size_image !~ '^https://' then
      raise exception 'Invalid wooden spool size or image: %', size_value;
    end if;

    if (select array_agg(attributes->>'COLOR' order by attributes->>'COLOR') from public.product_skus
        where product_id = source_product.id and attributes->>'Size' = size_value
          and is_active = true and price_gbp > 0 and colour = '默认'
          and attributes = jsonb_build_object('Size', size_value, 'COLOR', attributes->>'COLOR'))
      is distinct from array['Espresso', 'Original Wood'] then
      raise exception 'Source SKU options for % changed since preflight', size_value;
    end if;

    size_label := replace(replace(size_value, 'cm*', ' × '), 'cm', ' cm');
    insert into public.products (
      name, slug, description, care_instructions, collection, is_active, is_featured,
      images, sort_order, attribute_config, specifications
    ) values (
      'Artisan Wooden Ribbon Spool – ' || size_label,
      'artisan-wooden-spool-' || replace(replace(size_value, 'cm*', '-x-'), '.', '-'),
      'A ' || size_label || ' hardwood spool for winding and storing ribbon. Choose Original Wood or Espresso.' || E'\n\n' ||
      regexp_replace(source_product.description, E'\n✦ Size &amp; Specifications\n.*\n✦ Craft Details', E'\n✦ Craft Details'),
      source_product.care_instructions, source_product.collection, true, source_product.is_featured,
      array_prepend(size_image, array_remove(source_product.images, size_image)),
      coalesce(source_product.sort_order, 0) + size_option.position - 1,
      jsonb_build_array(finish_config), jsonb_build_array(
        jsonb_build_object('key', 'Size', 'value', size_label),
        jsonb_build_object('key', 'Material', 'value', 'Hardwood')
      ) || coalesce(source_product.specifications, '[]'::jsonb)
    ) returning id into target_id;

    update public.product_skus set product_id = target_id, colour = attributes->>'COLOR', attributes = attributes - 'Size'
    where product_id = source_product.id and attributes->>'Size' = size_value;
    get diagnostics moved_count = row_count;
    if moved_count <> 2 then raise exception 'Unexpected SKU count for %', size_value; end if;
    size_products := size_products || jsonb_build_object(target_id::text, size_value);
  end loop;

  if exists (select 1 from public.product_skus where product_id = source_product.id) then
    raise exception 'Some wooden spool SKUs were not moved';
  end if;

  update public.products set is_active = false, updated_at = now() where id = source_product.id;
  insert into public.settings (key, value) values ('wooden_spool_sizes', jsonb_build_object(
    'id', source_product.id, 'name', source_product.name, 'sizes', size_products
  )::text);
end
$migration$;
