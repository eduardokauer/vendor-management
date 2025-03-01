#!/bin/sh
# Wait until PostgreSQL is ready
until nc -z postgres 5432; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done
echo "PostgreSQL is ready!"