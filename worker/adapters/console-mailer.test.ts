import { describe, expect, it, vi } from 'vitest';
import { ConsoleMailer, isLocalMailSink } from './cloudflare.ts';

describe('isLocalMailSink', () => {
  it('chỉ bật khi MAIL_SINK=console và SITE_ORIGIN là localhost', () => {
    expect(isLocalMailSink('console', 'http://localhost:8787')).toBe(true);
    expect(isLocalMailSink('console', 'http://127.0.0.1:8787')).toBe(true);
  });
  it('không bật ở staging, production, origin rỗng/sai hoặc sink khác', () => {
    expect(isLocalMailSink('console', 'https://gms-contact-staging.bongmedia-web.workers.dev')).toBe(false);
    expect(isLocalMailSink('console', 'https://gmshungyen.vn')).toBe(false);
    expect(isLocalMailSink('console', '')).toBe(false);
    expect(isLocalMailSink('console', undefined)).toBe(false);
    expect(isLocalMailSink(undefined, 'http://localhost:8787')).toBe(false);
    expect(isLocalMailSink('file', 'http://localhost:8787')).toBe(false);
  });
});

describe('ConsoleMailer', () => {
  it('in thư ra console và báo gửi thành công', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await new ConsoleMailer().send({
      kind: 'notify',
      from: 'a@x.test',
      to: 'b@x.test',
      subject: 'Chủ đề',
      text: 'nội dung',
      rawMime: 'MIME-RAW',
      sentAtIso: '2026-11-10T00:00:00Z',
    });
    expect(res).toEqual({ ok: true });
    expect(log).toHaveBeenCalledWith('MIME-RAW');
    log.mockRestore();
  });
});
