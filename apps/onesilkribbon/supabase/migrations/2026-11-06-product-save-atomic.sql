-- 商品保存/删除的事务化版本。只新增函数和缺失列，不删除、不改写已有业务数据。
-- 迁移可重复执行；执行后 API 会自动使用这些函数。
begin;

-- 线上表已经存在这些列；这里补 if not exists 是为了让全新数据库也能直接从
-- schema.sql + 迁移启动。
create table if not exists public.settings (
  key text primary key,
  value text
);
alter table public.settings enable row level security;
revoke all on public.settings from anon, authenticated;
grant all on public.settings to service_role;

alter table public.products
  add column if not exists sort_order integer default 0,
  add column if not exists attribute_config jsonb default '[]'::jsonb,
  add column if not exists specifications jsonb default '[]'::jsonb;

alter table public.product_skus
  add column if not exists attributes jsonb default '{}'::jsonb,
  add column if not exists images text[] default '{}';

-- 只取开头的整数，行为接近 JS parseInt；非法值返回 null，而不是让整笔保存失败。
create or replace function public.admin_parse_leading_int(p_value text)
returns integer language sql immutable as $$
  select nullif(substring(btrim(coalesce(p_value, '')) from '^[-+]?[0-9]+'), '')::integer
$$;

-- 生成 SKU 编码。随机段足够长，避免和已有 SKU 冲突。
create or replace function public.admin_sku_code(p_slug text)
returns text language sql volatile as $$
  select coalesce(nullif(btrim(p_slug), ''), 'product') || '-' ||
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
$$;

create or replace function public.admin_text_array(p_value jsonb)
returns text[] language sql immutable as $$
  select case
    when p_value is null or jsonb_typeof(p_value) <> 'array' then '{}'::text[]
    else array(select jsonb_array_elements_text(p_value))
  end
$$;

create or replace function public.admin_json_array(p_value jsonb)
returns jsonb language sql immutable as $$
  select case
    when p_value is null or jsonb_typeof(p_value) <> 'array' then '[]'::jsonb
    else p_value
  end
$$;

create or replace function public.admin_insert_sku(p_product_id uuid, p_slug text, p_sku jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_attr jsonb;
begin
  v_attr := case
    when jsonb_typeof(p_sku -> 'attributes') = 'object' then p_sku -> 'attributes'
    else '{}'::jsonb
  end;

  insert into public.product_skus(
    product_id, sku_code, colour, colour_hex, width_mm, length_m,
    price_gbp, stock_qty, is_active, attributes, images
  ) values (
    p_product_id,
    public.admin_sku_code(p_slug),
    coalesce(
      nullif(p_sku ->> 'colour', ''),
      nullif(v_attr ->> '颜色', ''),
      nullif(v_attr ->> 'Colour', ''),
      nullif(v_attr ->> 'Color', ''),
      '默认'
    ),
    coalesce(nullif(p_sku ->> 'colour_hex', ''), '#D4C5B0'),
    public.admin_parse_leading_int(coalesce(nullif(v_attr ->> '宽度', ''), v_attr ->> 'Width', p_sku ->> 'width_mm')),
    public.admin_parse_leading_int(coalesce(nullif(v_attr ->> '长度', ''), v_attr ->> 'Length', p_sku ->> 'length_m')),
    (p_sku ->> 'price_gbp')::numeric,
    coalesce((p_sku ->> 'stock_qty')::int, 0),
    coalesce((p_sku ->> 'is_active')::boolean, true),
    v_attr,
    public.admin_text_array(p_sku -> 'images')
  ) returning id into v_id;

  return v_id;
end $$;

-- 创建或更新商品。整个过程在一个事务里：任何一步失败，商品和 SKU 都不会留下
-- 半保存状态。库存仍然使用 loaded_stock_qty 做乐观并发保护。
create or replace function public.admin_save_product(
  p_product jsonb,
  p_skus jsonb,
  p_deleted_sku_ids jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_existing public.products%rowtype;
  v_existing_sku public.product_skus%rowtype;
  v_sku jsonb;
  v_attr jsonb;
  v_sku_id uuid;
  v_loaded int;
  v_new int;
  v_deleted int := 0;
  v_deactivated int := 0;
  v_del text;
  v_old_slug text;
  v_new_slug text;
  v_redirects text;
  v_map jsonb;
  v_created boolean := false;
begin
  if p_product is null or jsonb_typeof(p_product) <> 'object' then
    raise exception 'invalid_product';
  end if;
  if p_skus is null or jsonb_typeof(p_skus) <> 'array' then
    raise exception 'invalid_skus';
  end if;
  if p_deleted_sku_ids is null or jsonb_typeof(p_deleted_sku_ids) <> 'array' then
    raise exception 'invalid_deleted_skus';
  end if;

  -- 同一个 SKU 不能在提交列表里出现两次
  if exists (
    select 1 from (
      select value ->> 'id' as id
      from jsonb_array_elements(p_skus)
      where value ->> 'id' is not null
    ) submitted
    group by id having count(*) > 1
  ) then
    raise exception 'sku_duplicate';
  end if;

  -- 同一个 SKU 不能既提交又删除
  if exists (
    select 1
    from jsonb_array_elements(p_skus) submitted
    where submitted ->> 'id' is not null
      and submitted ->> 'id' in (select jsonb_array_elements_text(p_deleted_sku_ids))
  ) then
    raise exception 'sku_conflict';
  end if;

  if nullif(p_product ->> 'id', '') is not null then
    v_id := (p_product ->> 'id')::uuid;
    select * into v_existing from public.products where id = v_id for update;
    if not found then
      raise exception 'product_not_found';
    end if;

    v_old_slug := v_existing.slug;
    v_new_slug := case when p_product ? 'slug' then p_product ->> 'slug' else v_existing.slug end;

    -- 和旧 API 的 update 行为一致：payload 里没有的字段保持原值，不能因为
    -- 某个调用方少传一个字段就把商品信息清空。
    update public.products set
      name = case when p_product ? 'name' then p_product ->> 'name' else v_existing.name end,
      slug = v_new_slug,
      description = case when p_product ? 'description' then p_product ->> 'description' else v_existing.description end,
      collection = case when p_product ? 'collection' then p_product ->> 'collection' else v_existing.collection end,
      is_active = case when p_product ? 'is_active' then coalesce((p_product ->> 'is_active')::boolean, true) else v_existing.is_active end,
      is_featured = case when p_product ? 'is_featured' then coalesce((p_product ->> 'is_featured')::boolean, false) else v_existing.is_featured end,
      sort_order = case when p_product ? 'sort_order' then coalesce(nullif(p_product ->> 'sort_order', '')::int, 0) else v_existing.sort_order end,
      images = case when p_product ? 'images' then public.admin_text_array(p_product -> 'images') else v_existing.images end,
      attribute_config = case when p_product ? 'attribute_config' then public.admin_json_array(p_product -> 'attribute_config') else v_existing.attribute_config end,
      specifications = case when p_product ? 'specifications' then public.admin_json_array(p_product -> 'specifications') else v_existing.specifications end,
      updated_at = now()
    where id = v_id;

    -- 旧网址重定向：和 packages/core/lib/product-redirects.js 保持同一份数据格式。
    if v_old_slug is distinct from v_new_slug and nullif(v_old_slug, '') is not null then
      begin
        select value into v_redirects from public.settings where key = 'product_slug_redirects';
        if v_redirects is null or btrim(v_redirects) = '' then
          v_map := '{}'::jsonb;
        else
          v_map := v_redirects::jsonb;
        end if;
      exception when others then
        v_map := '{}'::jsonb;
      end;

      if v_map is null or jsonb_typeof(v_map) <> 'object' then
        v_map := '{}'::jsonb;
      end if;
      v_map := v_map || jsonb_build_object(v_old_slug, v_id::text);
      if v_new_slug is not null then
        v_map := v_map - v_new_slug;
      end if;
      insert into public.settings(key, value)
        values ('product_slug_redirects', v_map::text)
        on conflict (key) do update set value = excluded.value;
    end if;
  else
    insert into public.products(
      name, slug, description, collection, is_active, is_featured,
      sort_order, images, attribute_config, specifications
    ) values (
      p_product ->> 'name',
      p_product ->> 'slug',
      p_product ->> 'description',
      p_product ->> 'collection',
      coalesce((p_product ->> 'is_active')::boolean, true),
      coalesce((p_product ->> 'is_featured')::boolean, false),
      coalesce(nullif(p_product ->> 'sort_order', '')::int, 0),
      public.admin_text_array(p_product -> 'images'),
      public.admin_json_array(p_product -> 'attribute_config'),
      public.admin_json_array(p_product -> 'specifications')
    ) returning id into v_id;

    v_created := true;
    v_new_slug := p_product ->> 'slug';
  end if;

  -- 新建商品没有历史 SKU 可删；忽略误传的删除列表，保持旧 create 的行为。
  if not v_created then
    -- 先处理明确删除的 SKU。有订单历史的只停用，没有历史的才真正删除。
    -- 去重：旧前端可能把同一个 SKU 重复放进删除列表。
    for v_del in select distinct value from jsonb_array_elements_text(p_deleted_sku_ids) as deleted(value) loop
      select * into v_existing_sku
        from public.product_skus
        where id = v_del::uuid and product_id = v_id
        for update;
      if not found then
        raise exception 'sku_not_found';
      end if;

      if exists (select 1 from public.order_items where sku_id = v_existing_sku.id) then
        update public.product_skus set is_active = false where id = v_existing_sku.id;
        v_deactivated := v_deactivated + 1;
      else
        delete from public.product_skus where id = v_existing_sku.id;
        v_deleted := v_deleted + 1;
      end if;
    end loop;
  end if;

  -- 更新已有 SKU / 插入新 SKU。create 模式下一律插入，忽略误传的 id。
  for v_sku in select value from jsonb_array_elements(p_skus) loop
    v_attr := case
      when jsonb_typeof(v_sku -> 'attributes') = 'object' then v_sku -> 'attributes'
      else '{}'::jsonb
    end;

    if not v_created and nullif(v_sku ->> 'id', '') is not null then
      v_sku_id := (v_sku ->> 'id')::uuid;
      select * into v_existing_sku
        from public.product_skus
        where id = v_sku_id and product_id = v_id
        for update;
      if not found then
        raise exception 'sku_not_found';
      end if;

      v_loaded := public.admin_parse_leading_int(v_sku ->> 'loaded_stock_qty');
      v_new := public.admin_parse_leading_int(v_sku ->> 'stock_qty');

      if coalesce(v_new, 0) is distinct from coalesce(v_loaded, 0) then
        update public.product_skus set
          colour = coalesce(
            nullif(v_sku ->> 'colour', ''),
            nullif(v_attr ->> '颜色', ''),
            nullif(v_attr ->> 'Colour', ''),
            nullif(v_attr ->> 'Color', ''),
            '默认'
          ),
          colour_hex = coalesce(nullif(v_sku ->> 'colour_hex', ''), '#D4C5B0'),
          width_mm = public.admin_parse_leading_int(coalesce(nullif(v_attr ->> '宽度', ''), v_attr ->> 'Width', v_sku ->> 'width_mm')),
          length_m = public.admin_parse_leading_int(coalesce(nullif(v_attr ->> '长度', ''), v_attr ->> 'Length', v_sku ->> 'length_m')),
          price_gbp = (v_sku ->> 'price_gbp')::numeric,
          stock_qty = coalesce(v_new, 0),
          is_active = coalesce((v_sku ->> 'is_active')::boolean, true),
          attributes = v_attr,
          images = public.admin_text_array(v_sku -> 'images')
        where id = v_sku_id and product_id = v_id
          and ((v_loaded is null and stock_qty is null) or stock_qty = v_loaded);

        if not found then
          raise exception 'stock_conflict';
        end if;
      else
        -- 库存没改过就不写 stock_qty，避免覆盖这期间订单 webhook 扣掉的库存。
        update public.product_skus set
          colour = coalesce(
            nullif(v_sku ->> 'colour', ''),
            nullif(v_attr ->> '颜色', ''),
            nullif(v_attr ->> 'Colour', ''),
            nullif(v_attr ->> 'Color', ''),
            '默认'
          ),
          colour_hex = coalesce(nullif(v_sku ->> 'colour_hex', ''), '#D4C5B0'),
          width_mm = public.admin_parse_leading_int(coalesce(nullif(v_attr ->> '宽度', ''), v_attr ->> 'Width', v_sku ->> 'width_mm')),
          length_m = public.admin_parse_leading_int(coalesce(nullif(v_attr ->> '长度', ''), v_attr ->> 'Length', v_sku ->> 'length_m')),
          price_gbp = (v_sku ->> 'price_gbp')::numeric,
          is_active = coalesce((v_sku ->> 'is_active')::boolean, true),
          attributes = v_attr,
          images = public.admin_text_array(v_sku -> 'images')
        where id = v_sku_id and product_id = v_id;

        if not found then
          raise exception 'sku_not_found';
        end if;
      end if;
    else
      perform public.admin_insert_sku(v_id, v_new_slug, v_sku);
    end if;
  end loop;

  if v_created then
    return jsonb_build_object('id', v_id, 'deleted', 0, 'deactivated', 0);
  end if;
  return jsonb_build_object('ok', true, 'deleted', v_deleted, 'deactivated', v_deactivated);
end $$;

-- 删除商品也在一个事务里：有历史订单只软删除；没有历史才物理删除。
create or replace function public.admin_delete_product(p_product_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_count bigint;
begin
  perform 1 from public.products where id = p_product_id for update;
  if not found then
    raise exception 'product_not_found';
  end if;

  select count(*) into v_count
  from public.order_items
  where product_id = p_product_id
     or sku_id in (select id from public.product_skus where product_id = p_product_id);

  if v_count > 0 then
    update public.product_skus set is_active = false where product_id = p_product_id;
    update public.products set is_active = false, updated_at = now() where id = p_product_id;
    return jsonb_build_object('ok', true, 'softDeleted', true, 'orderItemCount', v_count);
  end if;

  delete from public.product_skus where product_id = p_product_id;
  delete from public.products where id = p_product_id;
  return jsonb_build_object('ok', true, 'softDeleted', false, 'orderItemCount', 0);
end $$;

-- 这些函数只给后台 service_role 使用，不能暴露给匿名或登录用户。
revoke all on function public.admin_parse_leading_int(text) from public, anon, authenticated;
revoke all on function public.admin_sku_code(text) from public, anon, authenticated;
revoke all on function public.admin_text_array(jsonb) from public, anon, authenticated;
revoke all on function public.admin_json_array(jsonb) from public, anon, authenticated;
revoke all on function public.admin_insert_sku(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.admin_save_product(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.admin_delete_product(uuid) from public, anon, authenticated;

grant execute on function public.admin_parse_leading_int(text) to service_role;
grant execute on function public.admin_sku_code(text) to service_role;
grant execute on function public.admin_text_array(jsonb) to service_role;
grant execute on function public.admin_json_array(jsonb) to service_role;
grant execute on function public.admin_insert_sku(uuid, text, jsonb) to service_role;
grant execute on function public.admin_save_product(jsonb, jsonb, jsonb) to service_role;
grant execute on function public.admin_delete_product(uuid) to service_role;

-- 让 PostgREST 立即刷新函数列表；即使没刷新，API 也会先回退到旧路径，不会中断保存。
notify pgrst, 'reload schema';

commit;
