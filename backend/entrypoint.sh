#!/bin/sh
set -e

echo "Applying database migrations..."
alembic upgrade head

echo "Starting the API..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-80}"
