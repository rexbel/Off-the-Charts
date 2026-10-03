#!/bin/bash
# Runs the production build on the Mac for the otc-edge Worker (see deploy/cloudflare).
# Build first with deploy/mac/build.sh. Secrets come from .env.production.local (gitignored).
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a
[ -f .env.production.local ] && . ./.env.production.local
set +a
export NODE_ENV=production PORT="${PORT:-3200}" HOSTNAME=127.0.0.1
# Keep the database and audio cache in the repo's data/ so rebuilds don't wipe them.
export DATABASE_URL="${DATABASE_URL:-file:$PWD/data/offthechart.db}"
cd .next/standalone
exec node server.js
