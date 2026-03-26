#!/bin/bash
set -euo pipefail

echo "Waiting for PostgreSQL to be ready..."
until docker compose exec -T postgres pg_isready -U "${DB_USER:-postgres}" >/dev/null 2>&1; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is up - running development migrations"
docker compose exec -T backend-dev npx knex migrate:latest

if [ "${1:-}" = "--seed" ]; then
  if find backend/db/seeds -maxdepth 1 -type f -name '*.js' | grep -q .; then
    echo "Running development seeds..."
    docker compose exec -T backend-dev npx knex seed:run
  else
    echo "No development seed files found in backend/db/seeds; skipping."
  fi
fi

echo "Database initialization completed!"
