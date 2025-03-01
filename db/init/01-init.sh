#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE DATABASE vms_dev;
    CREATE DATABASE vms_test;
    
    \c vms_dev
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    \c vms_test
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOSQL

echo "PostgreSQL initialized with uuid-ossp extension and postgres role"