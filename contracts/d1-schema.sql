-- D1 `gms_contact` (lượt 5, 31/10/2026). Thay ops-tables.sql. design.md §6, §6a.
-- Máy validate: bun x wrangler d1 execute gms_contact --local --file=02-design/contracts/d1-schema.sql (design.md "Đã kiểm").
-- PII chỉ ở bảng outbox. Đã gửi được ⇒ xoá ngay trong lượt Cron đó, chậm nhất ≤ 24 giờ sau khi gửi (prd §3b).
-- Chưa gửi được ⇒ giữ tối đa 7 ngày tính từ created_at (XQ-A2, admin chốt; api.ts OUTBOX.maxRetentionUnsentSeconds),
-- Cron dọn: hết hạn thì xoá + một cảnh báo chỉ nêu số lượng. Không cột nào giữ IP thô.
-- Lượt 9 (prd v0.5.1 §3b, S19): trần 7 ngày áp cho MỌI dòng outbox kể cả đã gửi chưa xoá; cộng D1 Time Travel 7 ngày
-- (gói Free) ⇒ bản sao xa nhất ≤ 14 ngày từ lúc nhận. Đổi gói làm Time Travel dài hơn ⇒ mốc 14 ngày sai (design.md §6).

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
  dedupe_hash     TEXT NOT NULL,                 -- lượt 9 (XQ-25(g)/M37): HMAC-SHA256(IP_HMAC_KEY, email|phone + nội dung
                                                 -- chuẩn hoá), hex; không còn SHA-256 trần
  body_b64        TEXT NOT NULL,                 -- lượt 8 (CPU, design.md §6g): khối thân thư của liên hệ này, mã base64
                                                 -- lúc enqueue (POST), đệm tới bội 57 byte ⇒ dòng 76 ký tự + CRLF; Cron chỉ
                                                 -- ghép chuỗi. Cùng PII với các cột trên, xoá cùng bản ghi.
                                                 -- Lượt 9: ≤ CRON_LIMITS.bodyB64MaxBytes; KHÔNG BAO GIỜ log cột này;
                                                 -- Cron đọc theo api.ts CRON_SELECT_COLUMNS, không SELECT *
  batch           TEXT NOT NULL DEFAULT 'single' CHECK (batch IN ('single','summary')),
  attempts        INTEGER NOT NULL DEFAULT 0,    -- +1 NGAY khi lấy lease (trước việc tốn CPU) ⇒ lượt bị ngắt vì CPU vẫn được đếm
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
  hash       TEXT PRIMARY KEY,                   -- cùng HMAC như outbox.dedupe_hash (lượt 9, M37)
  created_at INTEGER NOT NULL                    -- Cron xoá sau 3600 s
);

CREATE TABLE mail_log (                          -- đếm trần thư, không PII
  sent_at INTEGER NOT NULL,
  kind    TEXT NOT NULL CHECK (kind IN ('notify','summary','alert')),
  -- lượt 9 (XQ-32(d), M29(1)): mã cảnh báo api.ts MAIL_ALERT_CODES, chỉ khi kind='alert'; dùng để giới hạn lặp
  -- (vd tối đa 1 PENDING_OVERDUE_15M / giờ tròn). Mỗi PHẦN thư tóm tắt là một dòng kind 'summary', code NULL.
  code    TEXT CHECK ((kind = 'alert') = (code IS NOT NULL)),
  -- lượt 10 (XQ-33(c)): chỉ kind='summary' — epoch đầu giờ tròn (Asia/Ho_Chi_Minh) của created_at bản ghi ĐẦU phần.
  -- Phần k của giờ H = số dòng summary có summary_hour = H, cộng 1. SUMMARY_SPLIT khi k = 2 (một lần mỗi H).
  summary_hour INTEGER CHECK ((kind = 'summary') = (summary_hour IS NOT NULL))
);
CREATE INDEX mail_log_kind_time ON mail_log (kind, sent_at);

CREATE TABLE heartbeat (
  name    TEXT PRIMARY KEY,                      -- 'cron'
  last_at INTEGER NOT NULL
);
