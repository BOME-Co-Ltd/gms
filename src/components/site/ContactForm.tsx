'use client';
// Form liên hệ (U11, ux-spec §5.3 trạng thái F1–F5, §6.4–6.5 microcopy). Request/response: contracts/api.ts.
// Giữ chữ người dùng đã nhập khi báo lỗi; khoá nút khi đang gửi; Turnstile (interaction-only) chỉ nạp khi người dùng chạm vào form.
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { Locale } from '../../content/loader.ts';
import { Icon } from './icons.tsx';

type FieldKey = 'fullName' | 'email' | 'phone' | 'company' | 'message' | 'consent';
type Values = Record<Exclude<FieldKey, 'consent'>, string> & { consent: boolean };
type Errs = Partial<Record<FieldKey, string>>;
type Feedback =
  | { type: 'fields' }
  | { type: 'msg'; tone: 'error' | 'info'; body: React.ReactNode }
  | { type: 'success' }
  | null;

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __gmsTurnstileReady?: () => void;
  }
}

const IDS: Record<FieldKey, string> = {
  fullName: 'contact-name',
  email: 'contact-email',
  phone: 'contact-phone',
  company: 'contact-company',
  message: 'contact-message',
  consent: 'contact-consent',
};
const ORDER: FieldKey[] = ['fullName', 'email', 'phone', 'company', 'message', 'consent'];
const MAX: Partial<Record<FieldKey, number>> = { fullName: 200, email: 254, phone: 20, company: 200, message: 5000 };
// Ký tự điều khiển / ngắt dòng / ký tự ẩn khi dán (dựng bằng chuỗi để không dính ký tự ngắt dòng thật trong mã nguồn).
const CTRL = {
  test: (s: string): boolean => {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c <= 0x1f || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029) return true;
    }
    return false;
  },
};
const EMPTY: Values = { fullName: '', email: '', phone: '', company: '', message: '', consent: false };

const TEXT = {
  vi: {
    send: 'Gửi liên hệ',
    sending: 'Đang gửi…',
    okTitle: 'Đã gửi liên hệ',
    ok: 'Cảm ơn bạn. GMS đã nhận được thông tin và sẽ liên hệ lại.',
    again: 'Gửi liên hệ khác',
    home: 'Về trang chủ',
    errName: 'Vui lòng nhập họ và tên.',
    errContact: 'Vui lòng nhập email hoặc số điện thoại',
    errEmail: 'Email chưa đúng dạng. Ví dụ: ten@congty.vn',
    errPhone:
      'Số điện thoại chưa đúng. Nhập 8–20 ký tự gồm số, có thể có dấu + ở đầu, dấu cách, dấu chấm hoặc gạch ngang.',
    errMsg: 'Vui lòng nhập nội dung bạn muốn gửi.',
    errConsent: 'Vui lòng đồng ý với việc xử lý thông tin để gửi liên hệ.',
    errLong: (n: number) => `Nội dung dài quá ${n} ký tự. Vui lòng rút gọn.`,
    errChars: (l: string) =>
      `Ô “${l}” có ký tự không dùng được, ví dụ ký tự xuống dòng hoặc ký tự ẩn khi dán. Vui lòng xoá đi và gõ lại bằng chữ, số và dấu câu thông thường.`,
    sum: (n: number) => `Cần sửa ${n} mục trước khi gửi:`,
    rate: (s?: number) =>
      `Bạn đã gửi quá nhiều lần. Vui lòng thử lại sau ${s ? `${Math.ceil(s / 60)} phút` : 'ít phút'}. Chữ bạn đã nhập vẫn còn.`,
    human: 'Chưa xác minh được bạn là người thật. Vui lòng thử gửi lại. Chữ bạn đã nhập vẫn còn.',
    humanWait: 'Vui lòng hoàn tất bước xác minh bên dưới để gửi liên hệ.',
    origin:
      'Liên hệ chưa được gửi vì yêu cầu không đến từ trang web của GMS. Vui lòng mở form liên hệ trên trang web chính thức của GMS rồi gửi lại. Chữ bạn đã nhập vẫn còn trên trang này.',
    policy:
      'Chính sách bảo mật vừa được cập nhật. Vui lòng đọc lại và tick ô đồng ý, rồi gửi lại. Chữ bạn đã nhập vẫn còn.',
    policyLink: 'Chính sách bảo mật',
    tooBig: 'Nội dung gửi quá lớn. Vui lòng rút gọn rồi gửi lại.',
    fail: 'Chưa gửi được liên hệ của bạn, GMS chưa nhận được. Chữ bạn đã nhập vẫn còn; vui lòng thử lại sau ít phút.',
    off: 'Form liên hệ tạm thời chưa mở. Bạn có thể liên hệ GMS qua các kênh dưới đây.',
    chPhone: 'Điện thoại',
    chZalo: 'Nhắn Zalo',
    urgentCall: 'gọi ',
    urgentZalo: 'nhắn ',
    urgentLead: 'Nếu cần gấp, hãy ',
    urgentOr: ' hoặc ',
    name: 'Họ và tên (bắt buộc)',
    atLeast: 'Cần điền ít nhất email hoặc số điện thoại.',
    phoneLbl: 'Số điện thoại',
    companyLbl: 'Công ty / Tổ chức (không bắt buộc)',
    companyName: 'Công ty / Tổ chức',
    fullName: 'Họ và tên',
    msgLbl: 'Nội dung (bắt buộc)',
    consentPre: 'Tôi đồng ý để ',
    consentMid:
      ' thu thập và dùng họ tên, email hoặc số điện thoại, công ty và nội dung tôi nhập với mục đích trả lời liên hệ này. Xem ',
    privacy: 'Chính sách bảo mật',
    noscript: 'Form liên hệ cần bật JavaScript. Bạn có thể liên hệ GMS qua các kênh dưới đây.',
  },
  en: {
    send: 'Send message',
    sending: 'Sending…',
    okTitle: 'Message sent',
    ok: 'Thank you. GMS has received your details and will get back to you.',
    again: 'Send another message',
    home: 'Back to home page',
    errName: 'Please enter your full name.',
    errContact: 'Please enter an email or a phone number',
    errEmail: "That email doesn't look right. Example: name@company.com",
    errPhone:
      "That phone number doesn't look right. Use 8–20 characters: digits, an optional leading +, spaces, dots or hyphens.",
    errMsg: 'Please enter your message.',
    errConsent: 'Please agree to the processing of your details to send your message.',
    errLong: (n: number) => `This is longer than ${n} characters. Please shorten it.`,
    errChars: (l: string) =>
      `The “${l}” field contains characters that can't be used, such as a line break or a hidden character from pasting. Please delete it and retype using ordinary letters, numbers and punctuation.`,
    sum: (n: number) => `${n} item(s) to fix before sending:`,
    rate: (s?: number) =>
      `You've sent too many messages. Please try again ${s ? `in ${Math.ceil(s / 60)} minute(s)` : 'in a few minutes'}. What you typed is still here.`,
    human: "We couldn't verify that you're a person. Please try sending again. What you typed is still here.",
    humanWait: 'Please complete the verification below to send your message.',
    origin:
      "Your message wasn't sent because the request did not come from the GMS website. Please open the contact form on the official GMS website and send it again. What you typed is still on this page.",
    policy:
      'The privacy policy has just been updated. Please read it again, tick the consent box, then send again. What you typed is still here.',
    policyLink: 'Privacy policy',
    tooBig: "What you're sending is too large. Please shorten it and try again.",
    fail: "We couldn't send your message and GMS has not received it. What you typed is still here; please try again in a few minutes.",
    off: 'The contact form is temporarily unavailable. You can reach GMS through the channels below.',
    chPhone: 'Phone',
    chZalo: 'Message on Zalo',
    urgentCall: 'call ',
    urgentZalo: 'message us on ',
    urgentLead: 'If urgent, ',
    urgentOr: ' or ',
    name: 'Full name (required)',
    atLeast: 'Please provide at least an email or a phone number.',
    phoneLbl: 'Phone number',
    companyLbl: 'Company / Organisation (optional)',
    companyName: 'Company / Organisation',
    fullName: 'Full name',
    msgLbl: 'Message (required)',
    consentPre: 'I agree that ',
    consentMid:
      ' may collect and use the full name, email or phone number, company and message I enter in order to reply and respond to my inquiry. See the ',
    privacy: 'Privacy policy',
    noscript: 'The contact form needs JavaScript. You can reach GMS through the channels below.',
  },
} as const;

export interface ContactFormProps {
  locale: Locale;
  policyVersion: string;
  phoneRaw: string;
  phoneShown: string;
  zaloRaw: string;
  siteKey: string;
  homeHref: string;
  privacyHref: string;
  legalName: string;
}

export function ContactForm(p: ContactFormProps): React.ReactElement {
  const { locale } = p;
  const T = TEXT[locale];
  const [values, setValuesState] = useState<Values>(EMPTY);
  const [errs, setErrsState] = useState<Errs>({});
  const [feedback, setFeedbackState] = useState<Feedback>(null);
  const [busy, setBusyState] = useState(false);
  const [formOff, setFormOff] = useState(false);
  const [wait, setWait] = useState(false);
  const [policyChanged, setPolicyChanged] = useState(false);
  const [focusSeq, setFocusSeq] = useState(0);

  // Bản sao đồng bộ cho các callback (Turnstile, fetch) chạy ngoài vòng render.
  const valuesRef = useRef<Values>(EMPTY);
  const errsRef = useRef<Errs>({});
  const feedbackRef = useRef<Feedback>(null);
  const busyRef = useRef(false);
  const formOffRef = useRef(false);
  const policyVersionRef = useRef(p.policyVersion);
  const pending = useRef(false);
  const token = useRef('');
  const widgetId = useRef<string | null>(null);
  const tsState = useRef<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const slotRef = useRef<HTMLDivElement>(null);
  const trapRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<() => void>(() => {});
  const refocusName = useRef(false);

  const setValues = (v: Values) => {
    valuesRef.current = v;
    setValuesState(v);
  };
  const setFeedback = (f: Feedback) => {
    feedbackRef.current = f;
    setFeedbackState(f);
  };
  const setErrs = (e: Errs) => {
    errsRef.current = e;
    setErrsState(e);
    if (feedbackRef.current?.type === 'fields' && Object.keys(e).length === 0) setFeedback(null);
  };
  const setBusy = (b: boolean) => {
    busyRef.current = b;
    setBusyState(b);
    if (!b) setWait(false);
  };
  const showBlock = (body: React.ReactNode, tone: 'error' | 'info' = 'error') => {
    setFeedback({ type: 'msg', tone, body });
    setFocusSeq((n) => n + 1);
  };

  useEffect(() => {
    if (focusSeq > 0) boxRef.current?.focus();
  }, [focusSeq]);
  useEffect(() => {
    if (feedback === null && refocusName.current) {
      refocusName.current = false;
      document.getElementById(IDS.fullName)?.focus();
    }
  }, [feedback]);

  const val = (v: Values, k: Exclude<FieldKey, 'consent'>) => v[k].trim();
  const label = (k: FieldKey) => (k === 'company' ? T.companyName : T.fullName);

  const localMsg = (k: FieldKey, v: Values): string => {
    if (k === 'consent') return v.consent ? '' : T.errConsent;
    const s = val(v, k);
    if (k === 'fullName' && !s) return T.errName;
    if (k === 'message' && !s) return T.errMsg;
    if ((k === 'fullName' || k === 'company') && CTRL.test(s)) return T.errChars(label(k));
    if (k === 'email' && s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return T.errEmail;
    if (k === 'phone' && s && !/^\+?[0-9 .-]{8,20}$/.test(s)) return T.errPhone;
    const max = MAX[k];
    if (max && s.length > max) return T.errLong(max);
    return '';
  };
  const validateAll = (v: Values): Errs => {
    const out: Errs = {};
    for (const k of ORDER) {
      const m = localMsg(k, v);
      if (m) out[k] = m;
    }
    if (!val(v, 'email') && !val(v, 'phone')) {
      out.email = T.errContact;
      out.phone = T.errContact;
    }
    return out;
  };
  // Sửa lại ô đã báo lỗi (rời ô / đổi giá trị) ⇒ kiểm lại và gỡ lỗi của ô đó ngay.
  const recheck = (k: FieldKey, v: Values) => {
    const group: FieldKey[] = k === 'email' || k === 'phone' ? ['email', 'phone'] : [k];
    const next: Errs = { ...errsRef.current };
    let changed = false;
    for (const g of group) {
      if (!next[g]) continue;
      let m = localMsg(g, v);
      if (!m && next[g] === T.errContact && !val(v, 'email') && !val(v, 'phone')) m = T.errContact;
      if (m) next[g] = m;
      else delete next[g];
      changed = true;
    }
    if (changed) setErrs(next);
  };
  const change = (k: FieldKey, value: string | boolean) => {
    const next = { ...valuesRef.current, [k]: value } as Values;
    setValues(next);
    recheck(k, next);
  };

  // Mã lỗi trường của máy chủ → chữ (ux-spec §6.5); không map được ⇒ null (coi như F3c).
  const serverFieldMsgs = (fields: Record<string, string>): Errs | null => {
    const out: Errs = {};
    for (const key of Object.keys(fields)) {
      if (!(key in IDS)) return null;
      const k = key as FieldKey;
      const c = fields[key];
      let m: string | null = null;
      if (c === 'REQUIRED')
        m =
          k === 'fullName'
            ? T.errName
            : k === 'message'
              ? T.errMsg
              : k === 'consent'
                ? T.errConsent
                : k === 'email' || k === 'phone'
                  ? T.errContact
                  : null;
      else if (c === 'TOO_LONG') m = MAX[k] ? T.errLong(MAX[k] as number) : null;
      else if (c === 'INVALID_EMAIL') m = k === 'email' ? T.errEmail : null;
      else if (c === 'INVALID_PHONE') m = k === 'phone' ? T.errPhone : null;
      else if (c === 'CONTACT_REQUIRED') {
        out.email = T.errContact;
        out.phone = T.errContact;
        continue;
      } else if (c === 'CONSENT_REQUIRED') m = T.errConsent;
      else if (c === 'INVALID_CHARS') m = k === 'fullName' || k === 'company' ? T.errChars(label(k)) : null;
      if (!m) return null;
      out[k] = m;
    }
    return Object.keys(out).length ? out : null;
  };

  // ---- Turnstile (Managed, interaction-only, flexible; token dùng một lần ⇒ reset sau mọi phản hồi khác 200 {ok:true}) ----
  const resetWidget = () => {
    token.current = '';
    if (window.turnstile && widgetId.current !== null) {
      try {
        window.turnstile.reset(widgetId.current);
      } catch {
        /* widget đã gỡ */
      }
    }
  };
  const urgent = (): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    if (p.phoneRaw)
      parts.push(
        <span key="p">
          {T.urgentCall}
          <a href={`tel:${p.phoneRaw}`}>{p.phoneShown}</a>
        </span>,
      );
    if (p.zaloRaw)
      parts.push(
        <span key="z">
          {T.urgentZalo}
          <a href={p.zaloRaw} rel="noopener noreferrer">
            Zalo
          </a>
        </span>,
      );
    if (!parts.length) return null;
    return (
      <>
        {' '}
        {T.urgentLead}
        {parts.length === 2 ? (
          <>
            {parts[0]}
            {T.urgentOr}
            {parts[1]}
          </>
        ) : (
          parts[0]
        )}
        .
      </>
    );
  };
  const channelsList = (): React.ReactNode =>
    p.phoneRaw || p.zaloRaw ? (
      <ul>
        {p.phoneRaw ? (
          <li>
            {T.chPhone}: <a href={`tel:${p.phoneRaw}`}>{p.phoneShown}</a>
          </li>
        ) : null}
        {p.zaloRaw ? (
          <li>
            <a href={p.zaloRaw} rel="noopener noreferrer">
              {T.chZalo}
            </a>
          </li>
        ) : null}
      </ul>
    ) : null;
  const failNoToken = () => {
    pending.current = false;
    resetWidget();
    setBusy(false);
    showBlock(
      <>
        {T.fail}
        {urgent()}
      </>,
    );
  };
  const renderWidget = () => {
    if (widgetId.current !== null || !window.turnstile || !slotRef.current) return;
    widgetId.current = window.turnstile.render(slotRef.current, {
      sitekey: p.siteKey,
      action: 'contact',
      appearance: 'interaction-only',
      size: 'flexible',
      language: locale,
      callback: (t: string) => {
        token.current = t;
        setWait(false);
        if (pending.current) sendRef.current();
      },
      'error-callback': () => {
        token.current = '';
        if (pending.current) failNoToken();
        return true;
      },
      'expired-callback': () => {
        token.current = '';
      },
      'timeout-callback': () => {
        token.current = '';
      },
      'before-interactive-callback': () => {
        if (pending.current) setWait(true);
        else slotRef.current?.setAttribute('data-challenge', 'shown');
      },
      'after-interactive-callback': () => {
        setWait(false);
        slotRef.current?.removeAttribute('data-challenge');
      },
    });
  };
  const loadTurnstile = () => {
    if (tsState.current !== 'idle' || !p.siteKey) return;
    tsState.current = 'loading';
    window.__gmsTurnstileReady = () => {
      tsState.current = 'ready';
      renderWidget();
    };
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__gmsTurnstileReady';
    s.async = true;
    s.defer = true;
    s.onerror = () => {
      tsState.current = 'failed';
      if (pending.current) failNoToken();
    };
    document.head.appendChild(s);
  };

  // ---- gửi ----
  const showSuccess = () => {
    pending.current = false;
    setBusy(false);
    setFeedback({ type: 'success' });
    setFocusSeq((n) => n + 1);
  };
  const onResult = (
    status: number,
    data: {
      ok?: boolean;
      code?: string;
      fields?: Record<string, string>;
      retryAfterSeconds?: number;
      policyVersion?: string;
    } | null,
  ) => {
    if (status === 200 && data?.ok === true) {
      showSuccess();
      return;
    }
    resetWidget();
    setBusy(false);
    const code = data?.code;
    if (status === 503 && code === 'FORM_DISABLED') {
      formOffRef.current = true;
      setFormOff(true);
      showBlock(
        <>
          <p style={{ margin: '0 0 6px' }}>{T.off}</p>
          {channelsList()}
        </>,
        'info',
      );
    } else if (status === 422 && code === 'VALIDATION' && data?.fields && serverFieldMsgs(data.fields)) {
      setErrs(serverFieldMsgs(data.fields) as Errs);
      setFeedback({ type: 'fields' });
      setFocusSeq((n) => n + 1);
    } else if (status === 403 && code === 'HUMAN_CHECK_FAILED') {
      showBlock(T.human);
    } else if (status === 403 && code === 'ORIGIN_REJECTED') {
      showBlock(
        <>
          {T.origin}
          {urgent()}
        </>,
      );
    } else if (status === 429 && code === 'RATE_LIMITED') {
      showBlock(T.rate(data?.retryAfterSeconds));
    } else if (status === 409 && code === 'POLICY_CHANGED') {
      if (data?.policyVersion) policyVersionRef.current = data.policyVersion;
      setValues({ ...valuesRef.current, consent: false });
      setPolicyChanged(true);
      showBlock(
        <>
          {T.policy}{' '}
          <a href={p.privacyHref} target="_blank" rel="noopener noreferrer">
            {T.policyLink}
          </a>
        </>,
      );
    } else if (status === 413 && code === 'PAYLOAD_TOO_LARGE') {
      showBlock(T.tooBig);
    } else {
      // STORE_FAILED, HUMAN_CHECK_UNAVAILABLE, 415, JSON sai dạng, mã lạ, không có JSON (F3c)
      showBlock(
        <>
          {T.fail}
          {urgent()}
        </>,
      );
    }
  };
  const send = () => {
    pending.current = false;
    const t = token.current;
    token.current = '';
    const v = valuesRef.current;
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale,
        fullName: val(v, 'fullName'),
        company: val(v, 'company') || undefined,
        email: val(v, 'email') || undefined,
        phone: val(v, 'phone') || undefined,
        message: val(v, 'message'),
        consent: true,
        policyVersion: policyVersionRef.current || '1.0',
        turnstileToken: t,
        pagePath: (window.location.pathname + window.location.search).slice(0, 512),
        website: trapRef.current?.value || undefined,
      }),
    })
      .then((res) =>
        res
          .json()
          .catch(() => null)
          .then((data) => onResult(res.status, data)),
      )
      .catch(() => onResult(0, null));
  };
  sendRef.current = send;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busyRef.current || formOffRef.current) return;
    const found = validateAll(valuesRef.current);
    setErrs(found);
    if (Object.keys(found).length > 0) {
      setFeedback({ type: 'fields' });
      setFocusSeq((n) => n + 1);
      return;
    }
    setFeedback(null);
    setBusy(true);
    pending.current = true;
    loadTurnstile();
    if (token.current) {
      send();
      return;
    }
    if (tsState.current === 'failed' || !p.siteKey) {
      failNoToken();
      return;
    }
    if (slotRef.current?.getAttribute('data-challenge') === 'shown') setWait(true);
  };
  const again = () => {
    setValues(EMPTY);
    setErrsState({});
    errsRef.current = {};
    setWait(false);
    resetWidget();
    refocusName.current = true;
    setFeedback(null);
  };

  const touch = () => loadTurnstile();

  const summaryItems = ORDER.filter((k) => errs[k] && !(k === 'phone' && errs.phone === errs.email));
  const done = feedback?.type === 'success';
  const fieldProps = (k: FieldKey) => ({
    id: IDS[k],
    'aria-invalid': errs[k] ? (true as const) : undefined,
    'aria-describedby': errs[k] ? `err-${k}` : undefined,
    onBlur: () => recheck(k, valuesRef.current),
  });
  const fieldError = (k: FieldKey) => (
    <p className="field-error" id={`err-${k}`} hidden={!errs[k]}>
      <Icon name="circle-alert" size={18} />
      <span className="fe-text">{errs[k] ?? ''}</span>
    </p>
  );

  return (
    <>
      <form
        data-testid="contact-form"
        id="gms-contact-form"
        method="post"
        action="/api/contact"
        noValidate
        data-locale={locale}
        data-policy-version={policyVersionRef.current}
        aria-busy={busy ? 'true' : 'false'}
        onSubmit={onSubmit}
        onFocus={touch}
        onPointerDown={touch}
        onTouchStart={touch}
      >
        <div id="contact-feedback-area">
          {feedback?.type === 'msg' ? (
            <div
              className={feedback.tone === 'info' ? 'notice-box' : 'error-box'}
              data-testid="contact-error"
              id="contact-summary"
              role="alert"
              tabIndex={-1}
              ref={boxRef}
            >
              {feedback.body}
            </div>
          ) : null}
          {feedback?.type === 'fields' ? (
            <div
              className="error-box"
              data-testid="contact-error"
              id="contact-summary"
              data-fields="1"
              role="alert"
              tabIndex={-1}
              ref={boxRef}
            >
              <p style={{ margin: '0 0 6px' }}>
                <strong>{T.sum(summaryItems.length)}</strong>
              </p>
              <ul>
                {summaryItems.map((k) => (
                  <li key={k}>
                    <a
                      href={`#${IDS[k]}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(IDS[k])?.focus();
                      }}
                    >
                      {errs[k]}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {done ? (
            <div
              className="success-box"
              data-testid="contact-success"
              id="contact-ok"
              role="status"
              tabIndex={-1}
              ref={boxRef}
            >
              <h2 style={{ margin: '0 0 6px', fontSize: '1.1rem' }}>{T.okTitle}</h2>
              <p style={{ margin: '0 0 10px' }}>{T.ok}</p>
              <p style={{ margin: 0 }}>
                <button type="button" className="btn btn-secondary" id="contact-again" onClick={again}>
                  {T.again}
                </button>{' '}
                <a href={p.homeHref}>{T.home}</a>
              </p>
            </div>
          ) : null}
        </div>
        <p id="contact-status" className="sr-only" role="status">
          {busy ? T.sending : ''}
        </p>
        <div hidden={done}>
          <div className="form-group">
            <label htmlFor={IDS.fullName}>{T.name}</label>
            <input
              {...fieldProps('fullName')}
              name="fullName"
              type="text"
              className="form-control"
              data-testid="contact-name"
              required
              maxLength={200}
              autoComplete="name"
              value={values.fullName}
              onChange={(e) => change('fullName', e.target.value)}
            />
            {fieldError('fullName')}
          </div>
          <p>
            <small>{T.atLeast}</small>
          </p>
          <div className="form-group">
            <label htmlFor={IDS.email}>Email</label>
            <input
              {...fieldProps('email')}
              name="email"
              type="email"
              className="form-control"
              data-testid="contact-email"
              maxLength={254}
              autoComplete="email"
              value={values.email}
              onChange={(e) => change('email', e.target.value)}
            />
            {fieldError('email')}
          </div>
          <div className="form-group">
            <label htmlFor={IDS.phone}>{T.phoneLbl}</label>
            <input
              {...fieldProps('phone')}
              name="phone"
              type="tel"
              className="form-control"
              data-testid="contact-phone"
              maxLength={20}
              autoComplete="tel"
              value={values.phone}
              onChange={(e) => change('phone', e.target.value)}
            />
            {fieldError('phone')}
          </div>
          <div className="form-group">
            <label htmlFor={IDS.company}>{T.companyLbl}</label>
            <input
              {...fieldProps('company')}
              name="company"
              type="text"
              className="form-control"
              data-testid="contact-company"
              maxLength={200}
              autoComplete="organization"
              value={values.company}
              onChange={(e) => change('company', e.target.value)}
            />
            {fieldError('company')}
          </div>
          <div className="form-group">
            <label htmlFor={IDS.message}>{T.msgLbl}</label>
            <textarea
              {...fieldProps('message')}
              name="message"
              rows={4}
              className="form-control"
              data-testid="contact-message"
              required
              maxLength={5000}
              value={values.message}
              onChange={(e) => change('message', e.target.value)}
            />
            {fieldError('message')}
          </div>
          <div className="hp-trap" aria-hidden="true">
            <input
              id="contact-trap"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              data-testid="contact-trap"
              ref={trapRef}
            />
          </div>
          <div className="form-group" data-testid="contact-consent-block">
            <label
              htmlFor={IDS.consent}
              data-testid="contact-consent-label"
              style={{ display: 'flex', gap: 14, alignItems: 'flex-start', fontWeight: 400, cursor: 'pointer' }}
            >
              <input
                {...fieldProps('consent')}
                name="consent"
                type="checkbox"
                data-testid="contact-consent"
                style={{ marginTop: 4, width: 24, height: 24, minWidth: 24, minHeight: 24, cursor: 'pointer' }}
                checked={values.consent}
                onChange={(e) => change('consent', e.target.checked)}
              />
              <span>
                {T.consentPre}
                {p.legalName}
                {T.consentMid}
                <a href={p.privacyHref} tabIndex={-1} {...(policyChanged ? { target: '_blank', rel: 'noopener' } : {})}>
                  {T.privacy}
                </a>
                .
              </span>
            </label>
            {fieldError('consent')}
          </div>
          <p id="contact-human-wait" className="notice-box" data-testid="contact-human-wait" hidden={!wait}>
            {wait ? T.humanWait : ''}
          </p>
          <div id="contact-human-slot" className="human-slot" data-testid="contact-human-slot" ref={slotRef} />
          <button
            type="submit"
            className="btn"
            data-testid="contact-submit"
            id="contact-submit-btn"
            disabled={busy || formOff}
          >
            {busy ? T.sending : T.send}
          </button>
        </div>
      </form>
      <noscript>
        <p>{T.noscript}</p>
      </noscript>
    </>
  );
}
