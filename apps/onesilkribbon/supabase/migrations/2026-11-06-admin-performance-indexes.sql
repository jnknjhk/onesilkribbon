-- 后台列表与工作台常用的查询索引。只新增索引，不删除、不改写业务数据。
begin;

create index if not exists orders_created_at_idx
  on public.orders(created_at desc);

create index if not exists orders_status_created_at_idx
  on public.orders(status, created_at desc);

create index if not exists order_items_sku_id_idx
  on public.order_items(sku_id);

create index if not exists order_items_product_id_idx
  on public.order_items(product_id);

create index if not exists email_log_status_created_at_idx
  on public.email_log(status, created_at desc);

notify pgrst, 'reload schema';

commit;
