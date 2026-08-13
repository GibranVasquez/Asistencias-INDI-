#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE=(docker compose -p indi-migration-test -f "$ROOT_DIR/docker-compose.migration-test.yml")
SOURCE_DATABASE_URL="${SOURCE_DATABASE_URL:-postgresql://indi_migration_test:migration_test_only@127.0.0.1:55432/indi_source_test}"
TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-postgresql://indi_migration_test:migration_test_only@127.0.0.1:55433/indi_mexico_test}"
export SOURCE_DATABASE_URL TARGET_DATABASE_URL
TEMP_DIR="$(mktemp -d)"

cleanup() {
  "${COMPOSE[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf -- "$TEMP_DIR"
}
trap cleanup EXIT INT TERM

node "$ROOT_DIR/scripts/migration/url-guard.mjs"
"${COMPOSE[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
"${COMPOSE[@]}" up -d --wait

start_total=$SECONDS
start=$SECONDS
(cd "$ROOT_DIR" && DATABASE_URL="$SOURCE_DATABASE_URL" DIRECT_URL="$SOURCE_DATABASE_URL" npx prisma migrate deploy)
docker run --rm --network host -v "$ROOT_DIR/scripts/migration:/migration:ro" postgres:16-alpine psql "$SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -f /migration/seed-fictitious.sql >/dev/null
echo "timing.seed=$((SECONDS-start))s"

start=$SECONDS
docker run --rm --network host -v "$TEMP_DIR:/work" postgres:16-alpine pg_dump "$SOURCE_DATABASE_URL" --format=custom --no-owner --no-acl --file=/work/indi-test.dump
echo "timing.dump=$((SECONDS-start))s"

start=$SECONDS
docker run --rm --network host -v "$TEMP_DIR:/work" postgres:16-alpine pg_restore --dbname="$TARGET_DATABASE_URL" --no-owner --no-acl --exit-on-error /work/indi-test.dump
echo "timing.restore=$((SECONDS-start))s"

start=$SECONDS
node "$ROOT_DIR/scripts/migration/verify-migration.mjs"
echo "timing.verify=$((SECONDS-start))s"

start=$SECONDS
(cd "$ROOT_DIR" && npm run build >/dev/null)
node "$ROOT_DIR/scripts/migration/backend-smoke.mjs"
echo "timing.smoke=$((SECONDS-start))s"
echo "timing.total=$((SECONDS-start_total))s"
echo "MIGRATION REHEARSAL: PASS"
