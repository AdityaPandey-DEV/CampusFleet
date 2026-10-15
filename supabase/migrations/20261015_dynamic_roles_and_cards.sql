-- Migration: Dynamic Role-Based Access Control (HRBAC) & System Cards Architecture
-- Date: 2026-10-15
-- Features:
--   1. system_cards: Unified functional desk cards (Buses, Routes, Trips, etc.)
--   2. system_roles: Hierarchical roles with parent_role_key inheritance
--   3. role_cards: Junction mapping roles to direct cards
--   4. Automatic zero-touch seeding of default roles, cards, and admin user

-- 1. Create system_cards table
CREATE TABLE IF NOT EXISTS public.system_cards (
    key VARCHAR(50) PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(50) NOT NULL,
    route VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create system_roles table with hierarchy and portal presentation support
CREATE TABLE IF NOT EXISTS public.system_roles (
    key VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_role_key VARCHAR(50) REFERENCES public.system_roles(key) ON DELETE SET NULL,
    hierarchy_level INT DEFAULT 1,
    portal_path VARCHAR(150),
    short_label VARCHAR(50),
    icon VARCHAR(50) DEFAULT 'ShieldCheck',
    color VARCHAR(50) DEFAULT 'text-blue-500',
    gradient VARCHAR(50) DEFAULT 'bg-blue-600',
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create role_cards junction table
CREATE TABLE IF NOT EXISTS public.role_cards (
    role_key VARCHAR(50) NOT NULL REFERENCES public.system_roles(key) ON DELETE CASCADE,
    card_key VARCHAR(50) NOT NULL REFERENCES public.system_cards(key) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (role_key, card_key)
);

-- 4. Add custom_cards column to users table if not exists
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_cards TEXT[] DEFAULT NULL;

-- 5. Update users role check to include role_manager and allow dynamic roles
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 6. Zero-Touch Seed: Functional System Cards
INSERT INTO public.system_cards (key, title, description, icon, route, category, sort_order) VALUES
('role_manager',  'Role & Access Manager', 'Manage staff accounts, assign roles, and configure hierarchy flowchart.', 'ShieldCheck', '/role-manager', 'Administration', 1),
('users',         'User Accounts',         'Search, add, and manage user accounts and login access.',                  'Users',       '/cards/users', 'Administration', 2),
('hierarchy',     'Role Hierarchy Tree',   'Interactive visual flowchart of reporting and access hierarchy.',           'GitFork',     '/cards/hierarchy', 'Administration', 3),
('buses',         'Bus Fleet',             'Manage buses, registrations, seat layouts, and print seat QRs.',              'BusFront',    '/cards/buses', 'Fleet Logistics', 4),
('routes',        'Routes & Stops',        'Manage corridors, bus stops, pickup timings, and route maps.',               'Route',       '/cards/routes', 'Fleet Logistics', 5),
('trips',         'Today''s Trips',        'Monitor live departures, dispatch trips, and combine buses.',                 'Navigation',  '/cards/trips', 'Fleet Logistics', 6),
('drivers',       'Assign Drivers',        'Assign drivers and conductors to specific buses and shifts.',                'UserCheck',   '/cards/drivers', 'Fleet Logistics', 7),
('combine_buses', 'Combine Buses',         'Merge low-occupancy routes to optimize fleet fuel and driver hours.',         'GitMerge',    '/cards/combine-buses', 'Fleet Logistics', 8),
('demand',        'Demand Analytics',      'Predictive passenger demand patterns and stop congestion heatmaps.',          'BarChart2',   '/cards/demand', 'Fleet Logistics', 9),
('billing',       'Bus Fees',              'Approve student payment receipts, manage fee balances, and UPI QR.',          'CreditCard',  '/cards/billing/approvals', 'Finance & Accounts', 10),
('students',      'Students & Passes',     'Search student directory, verify passes, and manage classes.',                'GraduationCap','/cards/academics/students', 'Academics & Safety', 11),
('maintenance',   'Bus Repairs',           'Track workshop maintenance, engine servicing, and repair logs.',             'Wrench',      '/cards/maintenance', 'Fleet Logistics', 12),
('reports',       'Staff & Reports',       'Attendance logs, driver manifests, and audit reports.',                      'FileText',    '/cards/system/reports', 'Administration', 13),
('flowchart',     'Operational Flowchart', 'End-to-end operational dispatch workflow and dispatch sequence.',            'Workflow',    '/cards/flowchart', 'Administration', 14),
('settings',      'Desk Settings',         'Manage preferences, notifications, and profile details.',                     'Settings',    '/cards/settings', 'Administration', 15)
ON CONFLICT (key) DO UPDATE SET 
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  route = EXCLUDED.route,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order;

-- 7. Zero-Touch Seed: Default System Roles with Tree Hierarchy and Portal Presentation
-- Only core governance roles (admin, role_manager) are flagged as system protected
INSERT INTO public.system_roles (key, name, description, parent_role_key, hierarchy_level, portal_path, short_label, icon, color, gradient, is_system) VALUES
('admin',             'Super Administrator', 'Full master control over institution, settings, and role management', NULL,              1, '/admin',             'Admin Ops',        'LayoutDashboard', 'text-yellow-500', 'bg-yellow-600', TRUE),
('role_manager',      'Role & Access Manager','Configures role hierarchy, assigns cards, and manages staff',       'admin',           2, '/role-manager',      'Role Manager',     'ShieldCheck',     'text-indigo-500', 'bg-indigo-600', TRUE),
('transport_admin',   'Transport Admin',     'Oversees bus fleet, fee desks, student passes, and repairs',         'role_manager',    3, '/transport-admin',   'Transport Admin',  'Building2',       'text-blue-500',   'bg-blue-600',   FALSE),
('transport_manager', 'Transport Manager',   'Manages live operations, routes, drivers, and daily trips',          'transport_admin', 4, '/transport-manager', 'Transport Manager','Navigation',      'text-amber-500',  'bg-amber-600',  FALSE),
('driver',            'Driver',              'Operational telematics and route progression HUD',                   'transport_manager', 5, '/driver',            'Driver HUD',       'BusFront',        'text-green-500',  'bg-green-600',  FALSE),
('conductor',         'Conductor',           'Optical QR passenger manifest verification scanner',                 'transport_manager', 5, '/conductor',         'Conductor',        'FileCheck2',      'text-pink-500',   'bg-pink-600',   FALSE),
('teacher',           'Teacher',             'Classroom attendance and student transit status',                    'transport_admin', 4, '/teacher',           'Teacher',          'BookOpen',        'text-green-500',  'bg-green-600',  FALSE),
('student',           'Student',             'Student mobility pass, reservations, and live tracking',             NULL,              6, '/portal',            'Student',          'GraduationCap',   'text-blue-500',   'bg-blue-600',   FALSE)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  parent_role_key = EXCLUDED.parent_role_key,
  hierarchy_level = EXCLUDED.hierarchy_level,
  portal_path = EXCLUDED.portal_path,
  short_label = EXCLUDED.short_label,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  gradient = EXCLUDED.gradient,
  is_system = EXCLUDED.is_system;

-- 8. Zero-Touch Seed: Direct Role-to-Card Bindings
INSERT INTO public.role_cards (role_key, card_key) VALUES
('role_manager', 'role_manager'),
('role_manager', 'users'),
('role_manager', 'hierarchy'),
('transport_admin', 'buses'),
('transport_admin', 'billing'),
('transport_admin', 'students'),
('transport_admin', 'maintenance'),
('transport_admin', 'reports'),
('transport_manager', 'drivers'),
('transport_manager', 'routes'),
('transport_manager', 'trips'),
('transport_manager', 'combine_buses'),
('transport_manager', 'demand'),
('transport_manager', 'flowchart')
ON CONFLICT DO NOTHING;

-- 9. Zero-Touch Seed: Default Super Admin User (if none exists)
INSERT INTO public.users (id, email, full_name, role, provider, created_at)
VALUES ('admin-root-001', 'admin@campusfleet.com', 'System Administrator', 'admin', 'EMAIL_PASSWORD', NOW())
ON CONFLICT (email) DO NOTHING;

-- 10. Database Schema Enforcement: Core System Roles (admin, role_manager) Cannot Be Deleted
CREATE OR REPLACE FUNCTION public.protect_system_core_roles()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.key IN ('admin', 'role_manager') THEN
    RAISE EXCEPTION 'Cannot delete core system role: %', OLD.key;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_core_roles ON public.system_roles;

CREATE TRIGGER trg_protect_core_roles
BEFORE DELETE ON public.system_roles
FOR EACH ROW
EXECUTE FUNCTION public.protect_system_core_roles();
