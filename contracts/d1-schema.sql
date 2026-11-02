-- D1 `gms_contact` (lượt 5, 31/10/2026). Thay ops-tables.sql. design.md §6, §6a.
-- Máy validate: bun x wrangler d1 execute gms_contact --local --file=02-design/contracts/d1-schema.sql (chưa kiểm).
-- PII chỉ ở bảng outbox; xoá khi đã gửi (≤ 24 giờ). Không cột nào giữ IP thô.

CREATE TABLE outbox (
  id              TEXT PRIMARY KEY,              -- UUID v4
  created_at      INTEGER NOT NULL,              -- epoch giây
  locale          TEXT NOT NULL CHECK (locale IN ('vi','en')),
  full_name       TEXT NOT NULL,
  company         TEXT,
  email           TEXT,
  phone           TEXT,
  message         TEXT NOT NULL,
  page_path       TEXT NOT NULL,
  utm_json        TEXT,
  policy_version  TEXT NOT NULL,
  consent_at      INTEGER NOT NULL,
  dedupe_hash     TEXT NOT NULL,                 -- SHA-256(email|phone + nội dung chuẩn hoá)
  batch           TEXT NOT NULL DEFAULT 'single' CHECK (batch IN ('single','summary')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  lease_until     INTEGER,
  last_error      TEXT,                          -- mã lỗi, không PII
  alerted_at      INTEGER,                       -- lần cảnh báo gần nhất; lặp mỗi 24 giờ, xoá khi created_at quá 7 ngày (XQ-A2, api.ts OUTBOX)
  sent_at         INTEGER,                       -- gửi → ghi sent_at → xoá
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE INDEX outbox_due ON outbox (sent_at, next_attempt_at);
CREATE INDEX outbox_dedupe ON outbox (dedupe_hash, created_at);

CREATE TABLE rate_counter (
  key        TEXT NOT NULL,                      -- 'try:'|'ok:' + HMAC(IP hoặc /64); lượt 6: chỉ ghi SAU Turnstile đạt (design.md §6a)
  window_start INTEGER NOT NULL,
  hits       INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);

CREATE TABLE dedupe (                            -- tách khỏi outbox: outbox bị xoá ngay khi gửi xong
  hash       TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL                    -- Cron xoá sau 3600 s
);

CREATE TABLE mail_log (                          -- đếm trần thư, không PII
  sent_at INTEGER NOT NULL,
  kind    TEXT NOT NULL CHECK (kind IN ('notify','summary','alert'))
);
CREATE INDEX mail_log_kind_time ON mail_log (kind, sent_at);

CREATE TABLE heartbeat (
  name    TEXT PRIMARY KEY,                      -- 'cron'
  last_at INTEGER NOT NULL
);
