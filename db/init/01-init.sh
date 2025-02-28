#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'postgres';
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOSQL

echo "PostgreSQL initialized with uuid-ossp extension and postgres role"