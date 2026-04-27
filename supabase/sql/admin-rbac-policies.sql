-- Admin RBAC hardening for EduHub
-- Apply in Supabase SQL editor after validating table names/columns in your project.
-- Version: 2.0 (Expanded with complete table coverage, read access, and service_role bypass)

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Helper function: read role from JWT metadata claim.
create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select coalesce(
    lower((auth.jwt() -> 'user_metadata' ->> 'role')),
    ''
  );
$$;

-- Helper: check if current user is admin
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_user_role() = 'admin';
$$;

-- ============================================================================
-- BURSARIES TABLE
-- ============================================================================
-- Public/learner read access; admin-only write
alter table if exists public.bursaries enable row level security;

drop policy if exists bursaries_public_select on public.bursaries;
create policy bursaries_public_select
on public.bursaries
for select
to authenticated, anon
using (true);  -- Public read for discovery

drop policy if exists bursaries_admin_insert on public.bursaries;
create policy bursaries_admin_insert
on public.bursaries
for insert
to authenticated, service_role
with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists bursaries_admin_update on public.bursaries;
create policy bursaries_admin_update
on public.bursaries
for update
to authenticated, service_role
using (public.is_admin() or auth.role() = 'service_role')
with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists bursaries_admin_delete on public.bursaries;
create policy bursaries_admin_delete
on public.bursaries
for delete
to authenticated, service_role
using (public.is_admin() or auth.role() = 'service_role');

-- ============================================================================
-- INSTITUTIONS TABLE
-- ============================================================================
-- Public/learner read access; admin-only write
alter table if exists public.institutions enable row level security;

drop policy if exists institutions_public_select on public.institutions;
create policy institutions_public_select
on public.institutions
for select
to authenticated, anon
using (true);  -- Public read for discovery

drop policy if exists institutions_admin_insert on public.institutions;
create policy institutions_admin_insert
on public.institutions
for insert
to authenticated, service_role
with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists institutions_admin_update on public.institutions;
create policy institutions_admin_update
on public.institutions
for update
to authenticated, service_role
using (public.is_admin() or auth.role() = 'service_role')
with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists institutions_admin_delete on public.institutions;
create policy institutions_admin_delete
on public.institutions
for delete
to authenticated, service_role
using (public.is_admin() or auth.role() = 'service_role');

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
-- Users read/update own; admins manage all
alter table if exists public.profiles enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select
on public.profiles
for select
to authenticated
using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
on public.profiles
for update
to authenticated
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);  -- Users can only create their own

drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete
on public.profiles
for delete
to authenticated
using (public.is_admin());

-- ============================================================================
-- APPLICATIONS TABLE (optional, if used)
-- ============================================================================
-- Users own their applications; admins can view/manage all
alter table if exists public.applications enable row level security;

drop policy if exists applications_self_select on public.applications;
create policy applications_self_select
on public.applications
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists applications_self_insert on public.applications;
create policy applications_self_insert
on public.applications
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists applications_self_update on public.applications;
create policy applications_self_update
on public.applications
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists applications_self_delete on public.applications;
create policy applications_self_delete
on public.applications
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- ============================================================================
-- NOTIFICATIONS TABLE (optional, if used)
-- ============================================================================
-- Admin write-only; users read own; service_role for background jobs
alter table if exists public.notifications enable row level security;

drop policy if exists notifications_user_select on public.notifications;
create policy notifications_user_select
on public.notifications
for select
to authenticated
using (recipient_id = auth.uid() or public.is_admin());

drop policy if exists notifications_admin_insert on public.notifications;
create policy notifications_admin_insert
on public.notifications
for insert
to service_role
with check (true);  -- Service role can create notifications

drop policy if exists notifications_admin_update on public.notifications;
create policy notifications_admin_update
on public.notifications
for update
to authenticated, service_role
using (public.is_admin() or auth.role() = 'service_role')
with check (public.is_admin() or auth.role() = 'service_role');

drop policy if exists notifications_admin_delete on public.notifications;
create policy notifications_admin_delete
on public.notifications
for delete
to authenticated, service_role
using (public.is_admin() or auth.role() = 'service_role');

-- ============================================================================
-- AUDIT_LOGS TABLE (admin-only read, service_role append-only)
-- ============================================================================
-- Admin read-only; service_role append for background audit trail
alter table if exists public.audit_logs enable row level security;

drop policy if exists audit_logs_admin_select on public.audit_logs;
create policy audit_logs_admin_select
on public.audit_logs
for select
to authenticated
using (public.is_admin());

drop policy if exists audit_logs_service_insert on public.audit_logs;
create policy audit_logs_service_insert
on public.audit_logs
for insert
to service_role
with check (true);  -- Service role can append logs

-- ============================================================================
-- DEPLOYMENT NOTES & VALIDATION CHECKLIST
-- ============================================================================
-- 
-- IMPORTANT BEFORE APPLYING:
-- 1) Verify all table names exist in your Supabase schema.
-- 2) Adjust column names if your schema differs (e.g., profiles.id vs profiles.user_id).
-- 3) If using other tables (e.g., submissions, reviews), add similar policies.
-- 4) Test in development environment first; deployment is immediate and enforcement is live.
--
-- ROLES & PERMISSIONS:
-- - authenticated: Users signed in (stored auth tokens)
-- - anon: Unauthenticated requests (public access, use carefully)
-- - service_role: Backend Edge Functions with elevated privileges (bypass RLS)
--
-- AFTER DEPLOYMENT:
-- 1) Test admin write access from app (should work)
-- 2) Test learner read access (should work)
-- 3) Test learner write access (should fail with 403)
-- 4) Check backend/Edge Function operations (should bypass RLS via service_role)
--
-- ROLLBACK (if issues):
-- Drop all policies: SELECT 'drop policy if exists ' || policyname || ' on ' || schemaname || '.' || tablename || ';' FROM pg_policies WHERE schemaname = 'public';
-- Then re-run this script with corrections.
