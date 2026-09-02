-- 客户汇总视图。
--
-- 之前 /api/admin/customers 是把最近 5000 笔订单整表拉到 Node 里，再在内存中按邮箱
-- 聚合出"订单数 / 累计消费 / 最近购买"。订单一旦超过 5000 笔，被截断的老订单就不再
-- 参与聚合——页面不会报错，但每个老客户的累计消费和订单数都会**算少**。
-- 这不是"看不到数据"，是"显示出来的数字是错的"，所以必须把聚合下推到数据库。
--
-- 口径与原来的 JS 实现保持一致：统计**全部**订单，不区分状态（pending / cancelled
-- 也计入累计消费）。这一版只修"算少"的问题，不顺手改口径——要改成只算已付款订单
-- 是另一个决定，改了会让历史数字整体变小，需要单独确认。

create or replace view customer_summary as
select
  coalesce(o.customer_email, 'unknown')                                        as email,
  -- 姓名/城市/国家取最近一笔订单上的值：客户搬家或改名后，后台应该显示最新的那个
  (array_agg(o.shipping_name    order by o.created_at desc))[1]                as name,
  (array_agg(o.shipping_city    order by o.created_at desc))[1]                as city,
  (array_agg(o.shipping_country order by o.created_at desc))[1]                as country,
  count(*)::int                                                                as orders,
  coalesce(sum(o.total_gbp), 0)::numeric                                       as spent,
  max(o.created_at)                                                            as last_order,
  -- 同一邮箱可能既下过访客单也下过登录单，只要有一笔带 user_id 就认作已注册客户
  (array_agg(o.user_id) filter (where o.user_id is not null))[1]               as user_id
from orders o
group by coalesce(o.customer_email, 'unknown');

-- ⚠️ 安全：public schema 下新建的视图会被 PostgREST 自动暴露，而 Supabase 默认给
-- anon / authenticated 授予了 select 权限。这个视图里是全部客户的邮箱、姓名和消费额，
-- 绝不能让匿名 key 读到。后台走的是 service role，不受这里的回收影响。
revoke all on customer_summary from anon, authenticated;

-- 让 PostgREST 立刻重新加载 schema，新视图马上就能通过 API 访问。
-- 不加这句通常也会自动重载，只是可能要等一会儿；等待期间后台会继续走内存聚合的退路。
notify pgrst, 'reload schema';
