import {
  CONTACT_ENDPOINT,
  CONTACT_HEALTH_ENDPOINT,
  CONTACT_HTTP_STATUS,
  CONTACT_LIMITS,
  CONTACT_REQUIRED_MESSAGE,
  ContactErrorCode,
  ContactSubmitRequest,
  ContactSubmitResponse,
  FieldErrorCode,
  HEADER_UNSAFE_CHARS,
  Locale,
  TURNSTILE_WIDGET,
} from '../../../contracts/api.ts';

export {
  CONTACT_ENDPOINT,
  CONTACT_HEALTH_ENDPOINT,
  CONTACT_HTTP_STATUS,
  CONTACT_LIMITS,
  CONTACT_REQUIRED_MESSAGE,
  ContactErrorCode,
  ContactSubmitRequest,
  ContactSubmitResponse,
  FieldErrorCode,
  HEADER_UNSAFE_CHARS,
  Locale,
  TURNSTILE_WIDGET,
};

export function normalizeVNPhone(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.length > CONTACT_LIMITS.phone) return null;
  if (!/^\+?[0-9 .-]{8,20}$/.test(s)) return null;
  const compact = s.replace(/[ .-]/g, '');
  if (/^0[35789][0-9]{8}$/.test(compact) || /^02[0-9]{9}$/.test(compact)) {
    return `+84${compact.slice(1)}`;
  }
  if (/^\+84[35789][0-9]{8}$/.test(compact) || /^\+842[0-9]{9}$/.test(compact)) {
    return compact;
  }
  if (/^84[35789][0-9]{8}$/.test(compact) || /^842[0-9]{9}$/.test(compact)) {
    return `+${compact}`;
  }
  return null;
}

export function isValidPublicVNPhone(raw: string): boolean {
  return normalizeVNPhone(raw) !== null;
}

export function formatPublicPhone(e164OrRaw: string, locale: 'vi' | 'en'): string {
  const norm = normalizeVNPhone(e164OrRaw) ?? e164OrRaw.trim();
  const digits = norm.replace(/^\+84/, '0').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) {
    const p1 = digits.slice(1, 3);
    const p2 = digits.slice(3, 6);
    const p3 = digits.slice(6, 8);
    const p4 = digits.slice(8, 10);
    return locale === 'vi' ? `0${p1} ${p2} ${p3} ${p4}` : `+84 ${p1} ${p2} ${p3} ${p4}`;
  }
  return norm;
}
