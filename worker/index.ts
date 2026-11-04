import { CONTACT_ENDPOINT, CONTACT_HEALTH_ENDPOINT, WORKER_RESPONSE_HEADERS } from '../contracts/api.ts';
import {
  CfClientIp,
  CloudflareSendEmailMailer,
  ConsoleAppLogger,
  D1ContactQueue,
  D1RateCounter,
  SystemClock,
  TurnstileHumanCheck,
  WebCryptoIpKey,
} from './adapters/cloudflare.ts';
import { type ContactDeps, handleContactHealth, handleContactPost, runCronJob } from './domain/contact-service.ts';
import { isUsableTurnstileSecret } from './domain/human-check.ts';
import type { D1Database, Fetcher, ScheduledController } from './ports.ts';

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  MAIL?: { send(msg: unknown): Promise<void> };
  FORM_ENABLED?: string;
  POLICY_VERSION?: string;
  SITE_ORIGIN?: string;
  MAIL_FROM?: string;
  ALERT_TO?: string;
  CONTACT_RECIPIENT?: string;
  TURNSTILE_SECRET?: string;
  IP_HMAC_KEY?: string;
  DEPLOY_HOOK_URL?: string;
}

function makeProdDeps(env: Env): ContactDeps {
  const queue = new D1ContactQueue(env.DB);
  const rate = new D1RateCounter(env.DB);
  const mailer = new CloudflareSendEmailMailer(env.MAIL);
  const siteHost = (() => {
    try {
      return new URL(env.SITE_ORIGIN ?? '').hostname;
    } catch {
      return '';
    }
  })();
  const human = new TurnstileHumanCheck(env.TURNSTILE_SECRET ?? '', siteHost ? [siteHost] : []);
  const clock = new SystemClock();
  const clientIp = new CfClientIp();
  const ipKey = new WebCryptoIpKey(env.IP_HMAC_KEY ?? '');
  const logger = new ConsoleAppLogger();
  return {
    queue,
    rate,
    mailer,
    human,
    clock,
    clientIp,
    ipKey,
    logger,
    config: () => ({
      formEnabled: env.FORM_ENABLED !== 'false',
      policyVersion: env.POLICY_VERSION ?? '1.0',
      siteOrigin: env.SITE_ORIGIN ?? '',
      mailFrom: env.MAIL_FROM ?? 'thongbao@thongbao.gmshungyen.vn',
      alertTo: env.ALERT_TO ?? '',
      contactRecipient: env.CONTACT_RECIPIENT ?? '',
      humanSecretValid: isUsableTurnstileSecret(env.TURNSTILE_SECRET),
      allowedHostnames: siteHost ? [siteHost] : [],
    }),
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      const deps = makeProdDeps(env);
      if (url.pathname === CONTACT_ENDPOINT) {
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ ok: false, code: 'VALIDATION' }), {
            status: 405,
            headers: WORKER_RESPONSE_HEADERS,
          });
        }
        return handleContactPost(req, deps);
      }
      if (url.pathname === CONTACT_HEALTH_ENDPOINT) {
        if (req.method !== 'GET') {
          return new Response(JSON.stringify({ ok: false, code: 'VALIDATION' }), {
            status: 405,
            headers: WORKER_RESPONSE_HEADERS,
          });
        }
        return handleContactHealth(deps);
      }
      return new Response(JSON.stringify({ ok: false, code: 'VALIDATION' }), {
        status: 404,
        headers: WORKER_RESPONSE_HEADERS,
      });
    }
    if (env.ASSETS) {
      return env.ASSETS.fetch(req);
    }
    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    if (event.cron === '5 17 * * *') {
      if (env.DEPLOY_HOOK_URL) {
        await fetch(env.DEPLOY_HOOK_URL, { method: 'POST' }).catch(() => {});
      }
      return;
    }
    const deps = makeProdDeps(env);
    await runCronJob(deps);
  },
};
