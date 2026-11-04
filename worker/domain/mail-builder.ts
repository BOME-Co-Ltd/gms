import { MAIL_ALERT_CODES, MAIL_SUBJECT_PREFIX } from '../../contracts/api.ts';
import { ROUTES } from '../../contracts/routes.ts';
import type { MailSendInput, OutboxRecord } from '../ports.ts';

function toBase64Lines(utf8Text: string): string {
  const b64 = Buffer.from(utf8Text, 'utf8').toString('base64');
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 76) {
    lines.push(b64.slice(i, i + 76));
  }
  return lines.join('\r\n');
}

/**
 * Khối thân thư base64 tính lúc enqueue (design.md §6g): đệm khoảng trắng tới bội 57 byte ⇒ mọi dòng đúng 76 ký tự,
 * nối các khối bằng CRLF vẫn là base64 hợp lệ. Không có "=" ở giữa.
 */
export function encodeBodyB64(utf8Text: string): string {
  const raw = Buffer.from(utf8Text, 'utf8');
  const padded = Buffer.concat([raw, Buffer.alloc((57 - (raw.length % 57)) % 57, 0x20)]);
  const b64 = padded.toString('base64');
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));
  return lines.join('\r\n');
}

export function notifyBodyText(rec: OutboxRecord): string {
  const lines = [
    'Thông báo liên hệ mới từ website GMS Hưng Yên (bản Tiếng Việt):',
    `Họ và tên: ${rec.fullName}`,
    rec.company ? `Công ty / Tổ chức: ${rec.company}` : null,
    rec.email ? `Email: ${rec.email}` : null,
    rec.phone ? `Số điện thoại: ${rec.phone}` : null,
    `Ngôn ngữ (locale): ${rec.locale}`,
    `Trang nơi gửi: ${resolvePageLabelVi(rec.pagePath)} (${rec.pagePath})`,
    `Thời điểm đồng ý: ${formatVnTimestamp(rec.consentAt)}`,
    `Phiên bản chính sách bảo mật: ${rec.policyVersion}`,
    '',
    'Nội dung liên hệ:',
    rec.message,
  ].filter((x): x is string => x !== null);
  return `${lines.join('\n')}\n`;
}

export function encodeRfc2047B(text: string): string {
  const clean = text.replace(/[\r\n]+/g, ' ').trim();
  const b64 = Buffer.from(clean, 'utf8').toString('base64');
  return `=?UTF-8?B?${b64}?=`;
}

export function formatVnTimestamp(epochSec: number): string {
  const vnMs = (epochSec + 7 * 3600) * 1000;
  const d = new Date(vnMs);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

const PAGE_LABELS_VI: Record<string, string> = {
  home: 'Trang chủ',
  about: 'Giới thiệu',
  solutions: 'Giải pháp',
  technology: 'Công nghệ',
  products: 'Sản phẩm đầu ra',
  news: 'Tin tức',
  projects: 'Dự án / Thư viện',
  careers: 'Tuyển dụng',
  faq: 'FAQ',
  contact: 'Liên hệ',
  privacy: 'Chính sách bảo mật',
};

export function resolvePageLabelVi(pagePath: string): string {
  const [rawPath, rawQuery] = pagePath.split('?');
  if (rawQuery) {
    const params = new URLSearchParams(rawQuery);
    const fromKey = params.get('from');
    if (fromKey && PAGE_LABELS_VI[fromKey]) {
      return PAGE_LABELS_VI[fromKey];
    }
  }
  const clean = rawPath.replace(/\/$/, '') || '/';
  for (const [key, r] of Object.entries(ROUTES)) {
    if (r.vi === clean || r.en === clean) {
      return PAGE_LABELS_VI[key] ?? clean;
    }
  }
  if (clean.startsWith('/tin-tuc') || clean.startsWith('/en/news')) return 'Tin tức';
  if (clean.startsWith('/du-an-thu-vien') || clean.startsWith('/en/projects-library')) return 'Dự án / Thư viện';
  if (clean.startsWith('/tuyen-dung') || clean.startsWith('/en/careers')) return 'Tuyển dụng';
  return `Liên hệ (${clean})`;
}

export function buildRawMime(opts: {
  from: string;
  to: string;
  replyTo?: string;
  subjectHeaderValue: string;
  dateUtc: Date;
  bodyText: string;
  bodyB64?: string;
}): string {
  const domain = opts.from.split('@')[1] ?? 'gmshungyen.vn';
  const msgId = `<${crypto.randomUUID()}@${domain}>`;
  const headers: string[] = [`From: ${opts.from}`, `To: ${opts.to}`];
  if (opts.replyTo) {
    headers.push(`Reply-To: ${opts.replyTo}`);
  }
  headers.push(
    `Subject: ${opts.subjectHeaderValue}`,
    `Date: ${opts.dateUtc.toUTCString()}`,
    `Message-ID: ${msgId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
  );
  return `${headers.join('\r\n')}\r\n\r\n${opts.bodyB64 ?? toBase64Lines(opts.bodyText)}\r\n`;
}

export function buildNotifyMail(rec: OutboxRecord, from: string, to: string, nowSec: number): MailSendInput {
  const cleanName = rec.fullName.replace(/[\r\n]+/g, ' ').trim();
  const displaySubject = `${MAIL_SUBJECT_PREFIX.notify}${cleanName}`;
  const subjectHeaderValue = encodeRfc2047B(displaySubject);
  const text = rec.bodyB64 ? decodeBodyB64(rec.bodyB64) : notifyBodyText(rec);
  const sentAtDate = new Date(nowSec * 1000);
  const rawMime = buildRawMime({
    from,
    to,
    replyTo: rec.email ?? undefined,
    subjectHeaderValue,
    dateUtc: sentAtDate,
    bodyText: text,
    bodyB64: rec.bodyB64 || undefined,
  });
  return {
    kind: 'notify',
    from,
    to,
    replyTo: rec.email ?? undefined,
    subject: displaySubject,
    text,
    rawMime,
    sentAtIso: sentAtDate.toISOString(),
  };
}

/** Giải mã khối body_b64 (chỉ để hiển thị/kiểm; đường gửi dùng thẳng chuỗi base64). */
export function decodeBodyB64(b64: string): string {
  return Buffer.from(b64.replace(/\r?\n/g, ''), 'base64').toString('utf8');
}

/**
 * Thư tóm tắt một phần: thân = đầu thư (đệm bội 57 byte) + các body_b64 của liên hệ, ghép bằng CRLF (không giải mã,
 * không dựng lại từ cột PII). `part` ≥ 2 ⇒ Subject có "phần k"; khoảng giờ theo Asia/Ho_Chi_Minh.
 */
export function buildSummaryMail(
  records: OutboxRecord[],
  from: string,
  to: string,
  nowSec: number,
  opts: { hourStart: number; part: number } = { hourStart: Math.floor(nowSec / 3600) * 3600, part: 1 },
): MailSendInput {
  const range = `${formatVnTimestamp(opts.hourStart)}–${formatVnTimestamp(opts.hourStart + 3600).slice(-5)}`;
  const partLabel = opts.part > 1 ? ` (phần ${opts.part})` : '';
  const displaySubject = `${MAIL_SUBJECT_PREFIX.summary}${records.length} liên hệ mới, ${range}${partLabel}`;
  const subjectHeaderValue = encodeRfc2047B(displaySubject);
  const head = `Tóm tắt ${records.length} liên hệ mới từ website GMS Hưng Yên (${range})${partLabel}:\n`;
  // Bản ghi có body_b64 ⇒ ghép nguyên khối (không giải mã); chỉ bản ghi thiếu khối mới dựng từ trường
  const blocks = records.map((r) => r.bodyB64 || encodeBodyB64(notifyBodyText(r)));
  const bodyB64 = [encodeBodyB64(head), ...blocks].join('\r\n');
  const text = `${head}${records.map((r) => (r.bodyB64 ? '' : notifyBodyText(r))).join('')}`;
  const sentAtDate = new Date(nowSec * 1000);
  const replyTo = records.length === 1 && records[0].email ? records[0].email : undefined;
  const rawMime = buildRawMime({
    from,
    to,
    replyTo,
    subjectHeaderValue,
    dateUtc: sentAtDate,
    bodyText: text,
    bodyB64,
  });
  return {
    kind: 'summary',
    from,
    to,
    replyTo,
    subject: displaySubject,
    text,
    rawMime,
    sentAtIso: sentAtDate.toISOString(),
  };
}

export function buildAlertMail(
  opts: { count: number; reason: 'overdue' | 'overdue_15m' | 'expired_purged' | 'summary_split'; parts?: number },
  from: string,
  to: string,
  nowSec: number,
): MailSendInput {
  // summary_split: count = số liên hệ còn chờ của giờ đó, parts = số phần đã gửi (design.md §6g); chỉ số đếm, không PII
  const subjects = {
    overdue: `Có liên hệ chưa gửi được thư báo (${opts.count} mục quá 24 giờ)`,
    overdue_15m: `Có liên hệ chờ gửi quá 15 phút (${opts.count} mục)`,
    expired_purged: `Đã xoá ${opts.count} liên hệ quá hạn 7 ngày chưa gửi được`,
    summary_split: `${MAIL_ALERT_CODES.summaryParts}: thư tóm tắt của một giờ phải tách nhiều phần (còn ${opts.count} liên hệ chờ)`,
  } as const;
  const bodies = {
    overdue: `hiện có liên hệ chưa gửi được thư báo (${opts.count} mục sau hơn 24 giờ). Liên hệ vẫn được giữ trong hàng đợi để tiếp tục thử gửi lại.`,
    overdue_15m: `hiện có ${opts.count} liên hệ chờ gửi quá 15 phút. Liên hệ vẫn được giữ trong hàng đợi để tiếp tục thử gửi lại.`,
    expired_purged: `đã xoá ${opts.count} liên hệ chưa gửi được thư báo do quá hạn lưu 7 ngày.`,
    summary_split: `mã ${MAIL_ALERT_CODES.summaryParts}: thư tóm tắt của một giờ vượt trần kích thước nên được gửi thành nhiều phần (đã gửi ${opts.parts ?? 1} phần, còn ${opts.count} liên hệ chờ).`,
  } as const;
  const displaySubject = `${MAIL_SUBJECT_PREFIX.alert}${subjects[opts.reason]}`;
  const subjectHeaderValue = encodeRfc2047B(displaySubject);
  const text = `Cảnh báo kỹ thuật (không chứa dữ liệu cá nhân): ${bodies[opts.reason]}\n`;
  const sentAtDate = new Date(nowSec * 1000);
  const rawMime = buildRawMime({
    from,
    to,
    subjectHeaderValue,
    dateUtc: sentAtDate,
    bodyText: text,
  });
  return {
    kind: 'alert',
    from,
    to,
    subject: displaySubject,
    text,
    rawMime,
    sentAtIso: sentAtDate.toISOString(),
  };
}
