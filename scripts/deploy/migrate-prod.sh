#!/bin/sh
set -eu
# Chạy migration D1 trên production (cần xác nhận rõ ràng)
if [ "${CONFIRM_PROD_MIGRATE:-}" != "yes" ]; then
  echo "migrate-prod: chế độ khô (dry-run). Đặt CONFIRM_PROD_MIGRATE=yes để áp lên D1 production."
  exit 0
fi
bun x wrangler d1 execute gms_contact --remote --config wrangler.jsonc --file=contracts/d1-schema.sql
