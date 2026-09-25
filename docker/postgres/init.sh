#!/bin/sh
# Runs once, on first start of an empty data volume, as the postgres superuser.
# The APIs connect as a separate, non-superuser role that only owns its own databases, so a leaked
# app credential cannot run server-side programs (COPY ... FROM PROGRAM) or touch other databases.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE refunds_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER DATABASE refunds_laravel OWNER TO refunds_app;
CREATE DATABASE refunds_nest OWNER refunds_app;
-- Test databases for the backends' own suites (used by local development and CI, as the superuser).
CREATE DATABASE refunds_laravel_test;
CREATE DATABASE refunds_nest_test;
SQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname refunds_laravel \
  -c 'ALTER SCHEMA public OWNER TO refunds_app;'
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname refunds_nest \
  -c 'ALTER SCHEMA public OWNER TO refunds_app;'
