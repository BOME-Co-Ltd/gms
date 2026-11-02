-- KHÔNG CÒN DÙNG (lượt 5, 31/10/2026): bỏ Payload/Postgres. Thay bằng d1-schema.sql. Xoá khi design_approved.
-- Bảng vận hành NGOÀI Payload (Drizzle, schema "ops"). Collections nội dung do Payload sinh DDL
-- từ config (content-model.md). Máy validate: chạy file này vào Postgres trống
--   psql "$DATABASE_URL_TEST" -v ON_ERROR_STOP=1 -f 02-design/contracts/ops-tables.sql
-- PII: mail_outbox giữ địa chỉ nhận; login_log giữ IP thô (nhật ký đăng nhập, 90 ngày, chỉ QT đọc);
-- bộ đếm và địa chỉ quen chỉ giữ HMAC.
CREATE SCHEMA IF NOT EXISTS ops;

-- Bộ đếm chống lạm dụng. key = HMAC-SHA256(ip_key_current, ip/64 hoặc ipv4) || ':' || phạm vi.
-- expires_at ≤ now()+1h (prd §6); job "retention" xoá dòng hết hạn mỗi lượt.
CREATE TABLE ops.rate_counter (
  scope       text        NOT NULL CHECK (scope IN
                ('contact_ok','contact_any','login_acct_ip','login_ip','login_acct','notify_hour','step_up_verify_ip')),
  key         text        NOT NULL,
  window_start timestamptz NOT NULL,
  hits        integer     NOT NULL DEFAULT 0,
  blocked_until timestamptz,
  expires_at  timestamptz NOT NULL,
  PRIMARY KEY (scope, key, window_start),
  CHECK (expires_at <= window_start + interval '2 hours')
);

-- Khoá HMAC xoay (job rotateIpKey). Giữ khoá trước để đếm hết cửa sổ đang mở.
CREATE TABLE ops.ip_hash_key (
  id          serial PRIMARY KEY,
  secret      bytea       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  retired_at  timestamptz
);

-- Outbox thư báo liên hệ + thư cảnh báo dò mật khẩu + thư tóm tắt. Không chứa nội dung form
-- (thân thư dựng lúc gửi từ bản ghi Payload; G4: mặc định không PII trong thư — design.md §10).
CREATE TABLE ops.mail_outbox (
  id           bigserial PRIMARY KEY,
  kind         text        NOT NULL CHECK (kind IN ('contact_notify','contact_digest','login_alert','login_challenge')),
  ref_id       text,                          -- id Liên hệ / user Payload
  to_address   text        NOT NULL,          -- chụp lúc tạo (G2: đổi email nhận không đổi thư đã xếp)
  hour_bucket  timestamptz,                   -- giờ tròn Asia/Ho_Chi_Minh cho trần 30/giờ
  status       text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','held_for_digest','failed')),
  attempts     integer     NOT NULL DEFAULT 0,
  next_try_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz,
  last_error   text,                          -- mã lỗi nhà cung cấp, KHÔNG thân thư/địa chỉ
  CHECK (status <> 'failed' OR now() >= created_at)  -- failed khi quá 24h (job đặt cờ trên Liên hệ)
);
CREATE INDEX mail_outbox_due ON ops.mail_outbox (status, next_try_at);
-- (Lượt 3, XQ-12) Đếm thư đã gửi theo kind trong 24 giờ trượt cho MAIL_BUDGET (api.ts).
CREATE INDEX mail_outbox_sent_by_kind ON ops.mail_outbox (kind, sent_at) WHERE status = 'sent';
CREATE UNIQUE INDEX mail_outbox_digest_once ON ops.mail_outbox (kind, hour_bucket) WHERE kind = 'contact_digest';

-- Nhật ký đăng nhập (S34): chỉ Quản trị đọc; xoá > 90 ngày. IP thô được giữ ở đây theo prd §6
-- (nhật ký đăng nhập ≠ bộ đếm) — ghi trong bản đồ dữ liệu design.md §6.
CREATE TABLE ops.login_log (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  -- (Lượt 3, M13) Chỉ ghi chữ đã gõ khi khớp một tài khoản: người dùng hay gõ nhầm mật khẩu vào ô email,
  -- ghi nguyên chữ thì mật khẩu thô nằm 90 ngày trong DB + sao lưu. Không khớp ⇒ cả hai cột null.
  email_tried text,
  user_id     text,                           -- null khi email không tồn tại
  CHECK ((email_tried IS NULL) = (user_id IS NULL)),
  outcome     text        NOT NULL CHECK (outcome IN ('success','fail','blocked','step_up_required','step_up_ok')),
  ip          inet        NOT NULL,
  user_agent  text        NOT NULL DEFAULT ''
);
CREATE INDEX login_log_at ON ops.login_log (at);

-- Địa chỉ quen của tài khoản (90 ngày) cho bước kiểm thêm. Lưu /64 hoặc IPv4 dạng HMAC khoá cố định riêng.
CREATE TABLE ops.known_login_net (
  user_id     text        NOT NULL,
  net_hash    text        NOT NULL,
  last_ok_at  timestamptz NOT NULL,
  PRIMARY KEY (user_id, net_hash)
);

-- Thử thách bước kiểm thêm (S34, ADR-003). Mã 6 số chỉ lưu dạng băm; hết hạn 10 phút (api.ts STEP_UP);
-- job "retention" xoá dòng quá hạn. Không IP thô: net_hash cùng cách băm với known_login_net.
CREATE TABLE ops.login_challenge (
  id          uuid        PRIMARY KEY,
  user_id     text        NOT NULL,
  net_hash    text        NOT NULL,
  code_hash   text        NOT NULL,
  attempts    integer     NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  CHECK (expires_at <= created_at + interval '10 minutes')
);
CREATE INDEX login_challenge_expires ON ops.login_challenge (expires_at);

-- (Lượt 2) Bỏ ops.url_tombstone: mọi URL không còn xuất bản trả 404 (routes.ts DETAIL_HTTP, design.md §6e).

-- Khoá chạy job một bản: pg_try_advisory_lock(hashtext('gms-jobs')) — không cần bảng.
