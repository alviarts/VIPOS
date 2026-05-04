-- P2-02 multi-tenant: create a non-superuser application role so RLS policies
-- actually apply. Postgres skips RLS for SUPERUSER and BYPASSRLS roles, even
-- when ROW LEVEL SECURITY is FORCEd, so the app must connect with a role that
-- has neither attribute.
--
-- Run this once after `prisma migrate deploy` has set up the schema. The
-- script is idempotent and safe to re-run.
--
-- Production note: real deployments (Supabase, RDS, etc.) typically already
-- expose a non-superuser role for the app — use that, and skip this script.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vipos_app') THEN
    CREATE ROLE vipos_app WITH LOGIN PASSWORD 'apppass' NOSUPERUSER NOBYPASSRLS;
  ELSE
    ALTER ROLE vipos_app WITH LOGIN PASSWORD 'apppass' NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

-- Database-scoped grants. We use `current_database()` via dynamic SQL so the
-- script works regardless of the active database name.
DO $$
DECLARE
  db_name TEXT := current_database();
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO vipos_app', db_name);
END
$$;

GRANT USAGE ON SCHEMA public TO vipos_app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO vipos_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO vipos_app;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO vipos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO vipos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO vipos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO vipos_app;

-- Transfer table + sequence ownership to vipos_app so the app can run
-- TRUNCATE ... RESTART IDENTITY (which requires sequence ownership) and
-- DROP/ALTER as needed during tests. RLS still applies because every
-- table was migrated with FORCE ROW LEVEL SECURITY.
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I OWNER TO vipos_app', rec.tablename);
  END LOOP;
  FOR rec IN
    SELECT sequence_name FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('ALTER SEQUENCE %I OWNER TO vipos_app', rec.sequence_name);
  END LOOP;
END
$$;
