-- 1. Module
insert into public.modules (slug, name, description, icon, sort_order, is_active)
select 'telegram', 'Telegram', 'Bot conversacional con IA: KPIs, dashboards y análisis desde Telegram', 'Send', 35, true
where not exists (select 1 from public.modules where slug = 'telegram');

-- 2. Permissions
insert into public.permissions (module_id, action, description)
select m.id, 'view', 'Ver módulo Telegram'
from public.modules m
where m.slug = 'telegram'
  and not exists (
    select 1 from public.permissions p where p.module_id = m.id and p.action = 'view'
  );

insert into public.permissions (module_id, action, description)
select m.id, 'edit', 'Configurar bot y vincular chats de Telegram'
from public.modules m
where m.slug = 'telegram'
  and not exists (
    select 1 from public.permissions p where p.module_id = m.id and p.action = 'edit'
  );

-- 3. Grant 'view' to every built-in app_role
insert into public.role_permissions (role, permission_id)
select r.role, p.id
from (select unnest(enum_range(null::public.app_role)) as role) r
cross join public.permissions p
join public.modules m on m.id = p.module_id
where m.slug = 'telegram' and p.action = 'view'
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role = r.role and rp.permission_id = p.id
  );

-- 4. Grant 'edit' to admin / super_admin only (if those enum values exist)
insert into public.role_permissions (role, permission_id)
select r.role, p.id
from (select unnest(enum_range(null::public.app_role)) as role) r
cross join public.permissions p
join public.modules m on m.id = p.module_id
where m.slug = 'telegram' and p.action = 'edit'
  and r.role::text in ('admin','super_admin')
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role = r.role and rp.permission_id = p.id
  );

-- 5. Grant 'view' to every custom role
insert into public.custom_role_permissions (custom_role_id, permission_id)
select cr.id, p.id
from public.custom_roles cr
cross join public.permissions p
join public.modules m on m.id = p.module_id
where m.slug = 'telegram' and p.action = 'view'
  and not exists (
    select 1 from public.custom_role_permissions crp
    where crp.custom_role_id = cr.id and crp.permission_id = p.id
  );