#!/usr/bin/env bash
# Rebuild the local Supabase database (supabase start) from db/migrations, in order.
# Each migration runs in its own transaction, like a separate SQL editor run on the
# hosted project. Local testing only: it drops and recreates the public schema.
set -euo pipefail
container="${SUPABASE_DB_CONTAINER:-supabase_db_cammi-connect}"
cd "$(dirname "$0")/.."
psql_local() { docker exec -i "$container" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }

psql_local <<'SQL'
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
-- Recreate the hosted project's default grants (dropping the schema loses them);
-- migrations revoke anon/authenticated access table by table.
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
delete from auth.users;
SQL

for file in db/migrations/*.sql; do
  echo "applying $file"
  psql_local --single-transaction < "$file"
done
echo "all migrations applied"
