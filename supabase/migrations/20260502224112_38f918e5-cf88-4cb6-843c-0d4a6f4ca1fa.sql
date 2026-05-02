
-- Singleton state for getUpdates offset
create table if not exists public.telegram_bot_state (
  id int primary key check (id = 1),
  update_offset bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.telegram_bot_state (id, update_offset) values (1, 0)
  on conflict (id) do nothing;
alter table public.telegram_bot_state enable row level security;
create policy "service_role only state" on public.telegram_bot_state
  for all to service_role using (true) with check (true);

-- Link codes (one-time)
create table if not exists public.telegram_link_codes (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null,
  bot_id uuid,
  mode text not null default 'auto' check (mode in ('auto','text','dashboard')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  used_at timestamptz
);
create index if not exists idx_telegram_link_codes_user on public.telegram_link_codes(user_id);
alter table public.telegram_link_codes enable row level security;
create policy "users manage own codes" on public.telegram_link_codes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "service_role codes" on public.telegram_link_codes
  for all to service_role using (true) with check (true);

-- Permanent user-chat links
create table if not exists public.telegram_user_links (
  chat_id bigint primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null,
  bot_id uuid,
  mode text not null default 'auto' check (mode in ('auto','text','dashboard')),
  telegram_username text,
  telegram_first_name text,
  is_active boolean not null default true,
  linked_at timestamptz not null default now(),
  last_message_at timestamptz
);
create index if not exists idx_telegram_user_links_user on public.telegram_user_links(user_id);
create index if not exists idx_telegram_user_links_tenant on public.telegram_user_links(tenant_id);
alter table public.telegram_user_links enable row level security;
create policy "users view own links" on public.telegram_user_links
  for select to authenticated
  using (user_id = auth.uid() or has_role(auth.uid(),'super_admin'::app_role)
         or (has_role(auth.uid(),'tenant_admin'::app_role) and tenant_id = get_user_tenant(auth.uid())));
create policy "users delete own links" on public.telegram_user_links
  for delete to authenticated using (user_id = auth.uid() or has_role(auth.uid(),'super_admin'::app_role));
create policy "users update own links" on public.telegram_user_links
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "service_role links" on public.telegram_user_links
  for all to service_role using (true) with check (true);

-- Messages log
create table if not exists public.telegram_messages (
  update_id bigint primary key,
  chat_id bigint not null,
  user_id uuid,
  tenant_id uuid,
  direction text not null default 'in' check (direction in ('in','out')),
  message_text text,
  raw jsonb,
  reply_text text,
  status text default 'pending',
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_telegram_messages_chat on public.telegram_messages(chat_id, created_at desc);
alter table public.telegram_messages enable row level security;
create policy "tenant view telegram messages" on public.telegram_messages
  for select to authenticated
  using (tenant_id = any(get_accessible_tenant_ids(auth.uid())));
create policy "service_role messages" on public.telegram_messages
  for all to service_role using (true) with check (true);

-- Helper function: generate short random code
create or replace function public.generate_telegram_link_code(_user_id uuid, _tenant_id uuid, _bot_id uuid default null, _mode text default 'auto')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  -- expire previous unused codes for this user
  update public.telegram_link_codes set expires_at = now()
    where user_id = _user_id and used_at is null and expires_at > now();
  -- generate 8-char alphanumeric uppercase code
  new_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.telegram_link_codes(code,user_id,tenant_id,bot_id,mode)
    values (new_code,_user_id,_tenant_id,_bot_id,_mode);
  return new_code;
end;
$$;
