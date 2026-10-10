-- ============================================================================
-- JurisFlow · seed 001 · permission catalogue
-- ----------------------------------------------------------------------------
-- Every permission the API checks, grouped exactly like `PERMISSION_GROUPS` in
-- `frontend/src/utils/rbac.ts` and `backend/app/utils/rbac.py`. Keeping the
-- catalogue in the database lets the settings screen render the matrix from
-- data instead of a hard-coded list.
-- ============================================================================

insert into public.permissions (code, label, group_label) values
  -- Users & roles
  ('users.read',            'View users',                    'Users & roles'),
  ('users.write',           'Create / edit users',           'Users & roles'),
  ('roles.manage',          'Manage roles & permissions',    'Users & roles'),
  -- Clients
  ('clients.read',          'View clients',                  'Clients'),
  ('clients.write',         'Create / edit clients',         'Clients'),
  -- Cases
  ('cases.read',            'View cases',                    'Cases'),
  ('cases.write',           'Create / edit cases',           'Cases'),
  -- Consultations
  ('consultations.read',    'View consultations',            'Consultations'),
  ('consultations.review',  'Approve / decline consultations', 'Consultations'),
  -- Appointments
  ('appointments.read',     'View appointments',             'Appointments'),
  ('appointments.write',    'Schedule / edit appointments',  'Appointments'),
  -- Documents
  ('documents.read',        'View documents',                'Documents'),
  ('documents.write',       'Upload / manage documents',     'Documents'),
  -- AI
  ('nlp.run',               'Run AI case analysis',          'AI analysis'),
  -- Knowledge & FAQs
  ('faqs.read',             'View FAQs',                     'Knowledge & FAQs'),
  ('faqs.write',            'Manage FAQs',                   'Knowledge & FAQs'),
  -- Notifications
  ('notifications.read',    'View notifications',            'Notifications'),
  ('notifications.settings','Change notification settings',  'Notifications'),
  -- Firm
  ('reports.read',          'View reports',                  'Firm'),
  ('activity.read',         'View activity logs',            'Firm'),
  ('settings.manage',       'Manage firm settings',          'Firm')
on conflict (code) do update
  set label = excluded.label,
      group_label = excluded.group_label;
