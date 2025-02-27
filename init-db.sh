#!/bin/bash
set -e

echo "Waiting for PostgreSQL to be ready..."
until docker exec vms-postgres pg_isready -U "${DB_USER:-postgres}"; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is up - running migrations"
docker exec vms-backend npx knex migrate:latest

if [ "$1" = "--seed" ]; then
  echo "Running seeds..."
  docker exec vms-backend npx knex seed:run
fi

echo "Database initialization completed!"