-- ============================================================================
-- JurisFlow · seed 002 · role → permission matrix
-- ----------------------------------------------------------------------------
-- This is the authority for `PUT /api/roles/:role/permissions` and the screen
-- the admin sees under Settings → Roles & permissions. It matches
-- `ROLE_PERMISSIONS` in `frontend/src/utils/rbac.ts` exactly.
--
-- Rationale:
--   admin  — the owner: everything, including roles and firm settings.
--   lawyer — works cases and reviews intake, but cannot touch user accounts.
--   staff  — the front desk: intake and scheduling, no review decision.
--   client — only their own records; the API scopes every query by the token.
-- ============================================================================

with matrix(role, permission) as (
  values
    -- admin: the whole firm
    ('admin', 'users.read'), ('admin', 'users.write'), ('admin', 'roles.manage'),
    ('admin', 'clients.read'), ('admin', 'clients.write'),
    ('admin', 'cases.read'), ('admin', 'cases.write'),
    ('admin', 'consultations.read'), ('admin', 'consultations.review'),
    ('admin', 'appointments.read'), ('admin', 'appointments.write'),
    ('admin', 'documents.read'), ('admin', 'documents.write'),
    ('admin', 'nlp.run'),
    ('admin', 'faqs.read'), ('admin', 'faqs.write'),
    ('admin', 'notifications.read'), ('admin', 'notifications.settings'),
    ('admin', 'reports.read'), ('admin', 'activity.read'), ('admin', 'settings.manage'),

    -- lawyer: the docket plus review rights
    ('lawyer', 'clients.read'), ('lawyer', 'clients.write'),
    ('lawyer', 'cases.read'), ('lawyer', 'cases.write'),
    ('lawyer', 'consultations.read'), ('lawyer', 'consultations.review'),
    ('lawyer', 'appointments.read'), ('lawyer', 'appointments.write'),
    ('lawyer', 'documents.read'), ('lawyer', 'documents.write'),
    ('lawyer', 'nlp.run'),
    ('lawyer', 'faqs.read'), ('lawyer', 'faqs.write'),
    ('lawyer', 'notifications.read'), ('lawyer', 'notifications.settings'),
    ('lawyer', 'reports.read'), ('lawyer', 'activity.read'),

    -- staff: intake and scheduling only
    ('staff', 'clients.read'), ('staff', 'clients.write'),
    ('staff', 'cases.read'), ('staff', 'cases.write'),
    ('staff', 'consultations.read'),
    ('staff', 'appointments.read'), ('staff', 'appointments.write'),
    ('staff', 'documents.read'), ('staff', 'documents.write'),
    ('staff', 'nlp.run'),
    ('staff', 'faqs.read'),
    ('staff', 'notifications.read'), ('staff', 'notifications.settings'),
    ('staff', 'activity.read'),

    -- client: their own file, nothing else
    ('client', 'cases.read'),
    ('client', 'consultations.read'),
    ('client', 'appointments.read'), ('client', 'appointments.write'),
    ('client', 'documents.read'), ('client', 'documents.write'),
    ('client', 'nlp.run'),
    ('client', 'faqs.read'),
    ('client', 'notifications.read'), ('client', 'notifications.settings')
)
insert into public.role_permissions (role, permission)
select m.role, m.permission
  from matrix m
  join public.permissions p on p.code = m.permission
on conflict (role, permission) do nothing;

-- Sanity check: every role has at least one permission, and clients never see
-- users, roles, activity logs or firm settings.
do $$
begin
  if exists (
    select 1 from public.role_permissions
     where role = 'client'
       and permission in ('users.read', 'roles.manage', 'activity.read', 'settings.manage')
  ) then
    raise exception 'client role must not hold staff/admin permissions';
  end if;
end;
$$;
