#!/bin/bash
# Builds the standalone server and copies the static assets it serves.
set -euo pipefail
cd "$(dirname "$0")/../.."
npx -y pnpm@12.8.1 install --frozen-lockfile
npx -y pnpm@12.8.1 build
cp -R public .next/standalone/
cp -R .next/static .next/standalone/.next/
