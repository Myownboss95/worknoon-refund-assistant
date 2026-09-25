-- Runs once, on first start of an empty data volume. The default database is refunds_laravel
-- (POSTGRES_DB); this adds the second one so each backend owns its own schema.
CREATE DATABASE refunds_nest;

CREATE DATABASE refunds_laravel_test;
CREATE DATABASE refunds_nest_test;
