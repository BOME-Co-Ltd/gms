#!/bin/sh
set -eu
exec bun run scripts/deploy/deploy-prod.ts "$@"
