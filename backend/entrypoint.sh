#!/usr/bin/env bash
set -euo pipefail

# Apply migrations on boot for local/compose convenience. In production on
# App Platform set RUN_MIGRATIONS=false and run migrations from the dedicated
# PRE_DEPLOY job instead, so multiple web replicas do not race.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "Running database migrations..."
    python manage.py migrate --no-input
fi

exec "$@"
