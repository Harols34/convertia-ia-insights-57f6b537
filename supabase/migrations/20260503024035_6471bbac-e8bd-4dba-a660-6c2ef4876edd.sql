create or replace function public.generate_telegram_link_code(
  _user_id uuid,
  _tenant_id uuid,
  _bot_id uuid default null,
  _mode text default 'auto',
  _ttl_seconds integer default 1800
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  ttl integer;
begin
  -- clamp ttl: minimum 60s (1 min), maximum 2592000s (30 days)
  ttl := greatest(60, least(coalesce(_ttl_seconds, 1800), 2592000));

  -- expire previous unused codes for this user
  update public.telegram_link_codes set expires_at = now()
    where user_id = _user_id and used_at is null and expires_at > now();

  -- 8-char alphanumeric uppercase code
  new_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

  insert into public.telegram_link_codes(code,user_id,tenant_id,bot_id,mode,expires_at)
    values (new_code,_user_id,_tenant_id,_bot_id,_mode, now() + make_interval(secs => ttl));

  return new_code;
end;
$$;