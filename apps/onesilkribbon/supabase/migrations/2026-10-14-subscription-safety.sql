-- Additive only: existing subscribers, welcome claims and coupons are retained.
begin;
create table if not exists public.subscription_email_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  verify_token text not null,
  token_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists subscription_requests_email_created on public.subscription_email_requests(email,created_at desc);
create table if not exists public.subscription_email_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now()
);
create index if not exists subscription_attempts_created on public.subscription_email_attempts(created_at);
create index if not exists subscription_attempts_email_created on public.subscription_email_attempts(email,created_at desc);
alter table public.subscription_email_requests enable row level security;
alter table public.subscription_email_attempts enable row level security;
revoke all on public.subscription_email_requests,public.subscription_email_attempts from public,anon,authenticated;
grant select,insert,update,delete on public.subscription_email_requests,public.subscription_email_attempts to service_role;

create or replace function public.prepare_subscription_email(p_email text,p_source text,p_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_sub subscribers%rowtype; v_request subscription_email_requests%rowtype; v_email text;
begin
  v_email:=lower(trim(p_email));
  if v_email is null or length(v_email)>254 or v_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'
    or p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid subscription input';
  end if;
  -- One short transaction serializes the counters across all serverless instances.
  perform pg_advisory_xact_lock(714141006);
  if (select count(*) from subscription_email_attempts where created_at>now()-interval '1 hour')>=100 then
    return jsonb_build_object('limited',true,'retry_after',3600);
  end if;
  if exists(select 1 from subscription_email_attempts where email=v_email and created_at>now()-interval '60 seconds') then
    return jsonb_build_object('limited',true,'retry_after',60);
  end if;
  if (select count(*) from subscription_email_attempts where email=v_email and created_at>now()-interval '24 hours')>=3 then
    return jsonb_build_object('limited',true,'retry_after',86400);
  end if;
  -- Count accepted attempts even when the mail provider fails or no mail is needed.
  insert into subscription_email_attempts(email) values(v_email);
  select * into v_sub from subscribers where email=v_email for update;
  if found then
    if v_sub.verified then return jsonb_build_object('skip',true); end if;
    if v_sub.verify_token is null or v_sub.token_expires_at is null or v_sub.token_expires_at<=now() then
      update subscribers set verify_token=p_token,token_expires_at=now()+interval '24 hours',status='pending'
        where id=v_sub.id returning * into v_sub;
    end if;
  else
    insert into subscribers(email,source,status,verified,verify_token,token_expires_at)
      values(v_email,left(coalesce(nullif(p_source,''),'welcome_popup'),80),'pending',false,p_token,now()+interval '24 hours')
      returning * into v_sub;
  end if;
  -- Retry ambiguous/failed sends with the same provider key, within its 24h window.
  select * into v_request from subscription_email_requests
    where email=v_email and verify_token=v_sub.verify_token and sent_at is null
      and created_at>now()-interval '23 hours' order by created_at desc limit 1;
  if not found then
    insert into subscription_email_requests(email,verify_token,token_expires_at)
      values(v_email,v_sub.verify_token,v_sub.token_expires_at) returning * into v_request;
  end if;
  return to_jsonb(v_request);
end $$;
revoke all on function public.prepare_subscription_email(text,text,text) from public,anon,authenticated;
grant execute on function public.prepare_subscription_email(text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
