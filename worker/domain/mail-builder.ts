import { MAIL_SUBJECT_PREFIX } from '../../contracts/api.ts';
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
  return `${headers.join('\r\n')}\r\n\r\n${toBase64Lines(opts.bodyText)}\r\n`;
}

export function buildNotifyMail(rec: OutboxRecord, from: string, to: string, nowSec: number): MailSendInput {
  const cleanName = rec.fullName.replace(/[\r\n]+/g, ' ').trim();
  const displaySubject = `${MAIL_SUBJECT_PREFIX.notify}${cleanName}`;
  const subjectHeaderValue = encodeRfc2047B(displaySubject);
  const pageLabel = resolvePageLabelVi(rec.pagePath);
  const consentTime = formatVnTimestamp(rec.consentAt);
  const lines = [
    'Thông báo liên hệ mới từ website GMS Hưng Yên (bản Tiếng Việt):',
    `Họ và tên: ${rec.fullName}`,
    rec.company ? `Công ty / Tổ chức: ${rec.company}` : null,
    rec.email ? `Email: ${rec.email}` : null,
    rec.phone ? `Số điện thoại: ${rec.phone}` : null,
    `Ngôn ngữ (locale): ${rec.locale}`,
    `Trang nơi gửi: ${pageLabel} (${rec.pagePath})`,
    `Thời điểm đồng ý: ${consentTime}`,
    `Phiên bản chính sách bảo mật: ${rec.policyVersion}`,
    '',
    'Nội dung liên hệ:',
    rec.message,
  ].filter((x): x is string => x !== null);
  const text = `${lines.join('\n')}\n`;
  const sentAtDate = new Date(nowSec * 1000);
  const rawMime = buildRawMime({
    from,
    to,
    replyTo: rec.email ?? undefined,
    subjectHeaderValue,
    dateUtc: sentAtDate,
    bodyText: text,
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

export function buildSummaryMail(records: OutboxRecord[], from: string, to: string, nowSec: number): MailSendInput {
  const displaySubject = `${MAIL_SUBJECT_PREFIX.summary}${records.length} liên hệ mới`;
  const subjectHeaderValue = encodeRfc2047B(displaySubject);
  const parts: string[] = [`Tóm tắt ${records.length} liên hệ mới từ website GMS Hưng Yên:`, ''];
  records.forEach((rec, idx) => {
    const pageLabel = resolvePageLabelVi(rec.pagePath);
    const consentTime = formatVnTimestamp(rec.consentAt);
    parts.push(`--- Liên hệ #${idx + 1} ---`);
    parts.push(`Họ và tên: ${rec.fullName}`);
    if (rec.company) parts.push(`Công ty / Tổ chức: ${rec.company}`);
    if (rec.email) parts.push(`Email: ${rec.email}`);
    if (rec.phone) parts.push(`Số điện thoại: ${rec.phone}`);
    parts.push(`Ngôn ngữ (locale): ${rec.locale}`);
    parts.push(`Trang nơi gửi: ${pageLabel} (${rec.pagePath})`);
    parts.push(`Thời điểm đồng ý: ${consentTime}`);
    parts.push(`Phiên bản chính sách: ${rec.policyVersion}`);
    parts.push(`Nội dung: ${rec.message}`);
    parts.push('');
  });
  const text = `${parts.join('\n')}\n`;
  const sentAtDate = new Date(nowSec * 1000);
  const replyTo = records.length === 1 && records[0].email ? records[0].email : undefined;
  const rawMime = buildRawMime({
    from,
    to,
    replyTo,
    subjectHeaderValue,
    dateUtc: sentAtDate,
    bodyText: text,
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
  opts: { count: number; reason: 'overdue' | 'expired_purged' },
  from: string,
  to: string,
  nowSec: number,
): MailSendInput {
  const displaySubject =
    opts.reason === 'overdue'
      ? `${MAIL_SUBJECT_PREFIX.alert}Có liên hệ chưa gửi được thư báo (${opts.count} mục quá 24 giờ)`
      : `${MAIL_SUBJECT_PREFIX.alert}Đã xoá ${opts.count} liên hệ quá hạn 7 ngày chưa gửi được`;
  const subjectHeaderValue = encodeRfc2047B(displaySubject);
  const text =
    opts.reason === 'overdue'
      ? `Cảnh báo kỹ thuật (không chứa dữ liệu cá nhân): hiện có liên hệ chưa gửi được thư báo (${opts.count} mục sau hơn 24 giờ). Liên hệ vẫn được giữ trong hàng đợi để tiếp tục thử gửi lại.\n`
      : `Cảnh báo kỹ thuật (không chứa dữ liệu cá nhân): đã xoá ${opts.count} liên hệ chưa gửi được thư báo do quá hạn lưu 7 ngày.\n`;
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
