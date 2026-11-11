// Gửi thư qua SMTP (Zoho) bằng socket của Cloudflare — cùng cách www.bongmedia.vn đang dùng (worker-mailer).
// Bật khi đủ SMTP_HOST + SMTP_USER + SMTP_PASS; thiếu thì Worker dùng binding send_email như thiết kế cũ.
// worker-mailer import `cloudflare:sockets` ⇒ nạp động lúc gửi, để unit test (Node) không phải nạp module này.
import type { Mailer, MailSendInput, MailSendResult } from '../ports.ts';

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  /** Tên hiển thị của người gửi, vd "GMS Hưng Yên". */
  fromName?: string;
};

export function smtpConfigFromEnv(env: {
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  MAIL_FROM_NAME?: string;
}): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  const username = env.SMTP_USER?.trim();
  const password = env.SMTP_PASS ?? '';
  if (!host || !username || !password) return null;
  const port = Number(env.SMTP_PORT || 465);
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465;
  return { host, port, secure, username, password, fromName: env.MAIL_FROM_NAME?.trim() || undefined };
}

type Send = (
  server: Record<string, unknown>,
  mail: {
    from: { name?: string; email: string };
    to: string;
    reply?: string;
    subject: string;
    text: string;
  },
) => Promise<void>;

export class SmtpMailer implements Mailer {
  private cfg: SmtpConfig;
  private sendImpl?: Send;
  constructor(cfg: SmtpConfig, sendImpl?: Send) {
    this.cfg = cfg;
    this.sendImpl = sendImpl;
  }

  private async sender(): Promise<Send> {
    if (this.sendImpl) return this.sendImpl;
    const mod = await import('worker-mailer');
    return (server, mail) => mod.WorkerMailer.send(server as never, mail);
  }

  async send(msg: MailSendInput): Promise<MailSendResult> {
    try {
      const send = await this.sender();
      await send(
        {
          host: this.cfg.host,
          port: this.cfg.port,
          secure: this.cfg.secure,
          startTls: !this.cfg.secure,
          credentials: { username: this.cfg.username, password: this.cfg.password },
          authType: ['plain', 'login'],
          socketTimeoutMs: 9000,
        },
        {
          from: { name: this.cfg.fromName, email: msg.from },
          to: msg.to,
          reply: msg.replyTo,
          subject: msg.subject,
          text: msg.plainText ?? msg.text,
        },
      );
      return { ok: true };
    } catch {
      // Không log nội dung thư/địa chỉ; lỗi SMTP coi là tạm thời ⇒ hàng đợi thử lại theo OUTBOX.retryBackoffMinutes.
      return { ok: false, temporary: true, code: 'SMTP_SEND_FAILED' };
    }
  }
}
