'use client';

import type React from 'react';
import { useState } from 'react';
import { getDictionary, type Locale } from '../../i18n/index.ts';

export interface ContactFormSectionProps {
  locale: Locale;
  privacyHref: string;
  policyVersion?: string;
}

export function ContactFormSection({
  locale,
  privacyHref,
  policyVersion = '1.0',
}: ContactFormSectionProps): React.ReactElement {
  const dict = getDictionary(locale);
  const c = dict.contact;
  const b = dict.brand;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const errs: string[] = [];
    if (!fullName.trim()) errs.push(c.errRequiredName);
    if (!email.trim() && !phone.trim()) {
      errs.push(c.errRequiredContact);
    } else if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.push(c.errInvalidEmail);
    }
    if (!message.trim()) errs.push(c.errRequiredMessage);
    if (!consent) errs.push(c.errRequiredConsent);

    if (errs.length > 0) {
      setErrorMsg(errs.join(' '));
      return;
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          locale,
          fullName: fullName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          company: company.trim() || undefined,
          message: message.trim(),
          consent: true,
          policyVersion,
          turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
          pagePath: locale === 'vi' ? '/lien-he' : '/en/contact',
          website: website || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (res.ok && data.ok) {
        setSuccessMsg(c.successMsg);
      } else {
        setErrorMsg(`${c.errSendFailed} (${b.phoneDisplay})`);
      }
    } catch {
      setErrorMsg(`${c.errSendFailed} (${b.phoneDisplay})`);
    }
  };

  return (
    <>
      <section className="section-block">
        <p className="eyebrow">{c.eyebrow}</p>
        <h1>{c.title}</h1>

        <form data-testid="contact-form" method="post" action="/api/contact" noValidate onSubmit={handleSubmit}>
          {errorMsg ? (
            <div className="error-box" data-testid="contact-error" role="alert">
              {errorMsg}
            </div>
          ) : null}
          {successMsg ? (
            <div className="success-box" data-testid="contact-success" role="status">
              {successMsg}
            </div>
          ) : null}

          <div className="form-group">
            <label htmlFor="contact-name">{c.nameLabel}</label>
            <input
              id="contact-name"
              name="fullName"
              type="text"
              className="form-control"
              data-testid="contact-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              maxLength={200}
            />
          </div>
          <p>
            <small>{c.contactHint}</small>
          </p>
          <div className="form-group">
            <label htmlFor="contact-email">{c.emailLabel}</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              className="form-control"
              data-testid="contact-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
            />
          </div>
          <div className="form-group">
            <label htmlFor="contact-phone">{c.phoneLabel}</label>
            <input
              id="contact-phone"
              name="phone"
              type="tel"
              className="form-control"
              data-testid="contact-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
            />
          </div>
          <div className="form-group">
            <label htmlFor="contact-company">{c.companyLabel}</label>
            <input
              id="contact-company"
              name="company"
              type="text"
              className="form-control"
              data-testid="contact-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="form-group">
            <label htmlFor="contact-message">{c.messageLabel}</label>
            <textarea
              id="contact-message"
              name="message"
              rows={4}
              className="form-control"
              data-testid="contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              maxLength={5000}
            />
          </div>
          <div className="hp-trap" aria-hidden="true">
            <input
              id="contact-trap"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              data-testid="contact-trap"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <div className="form-group my-5" data-testid="contact-consent-block">
            <label
              htmlFor="contact-consent"
              data-testid="contact-consent-label"
              className="flex items-start gap-3 cursor-pointer"
            >
              <input
                id="contact-consent"
                name="consent"
                type="checkbox"
                data-testid="contact-consent"
                className="mt-1 w-5 h-5 min-w-[20px] min-h-[20px] rounded border-[#a3b899] text-[#0f5838] focus:ring-[#0f5838] cursor-pointer"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span className="text-sm leading-relaxed text-[#1b4332]">
                {c.consentPrefix}
                <a
                  href={privacyHref}
                  tabIndex={-1}
                  className="font-semibold underline text-[#0f5838] hover:text-[#2d6a4f]"
                >
                  {c.consentLinkText}
                </a>
                .
              </span>
            </label>
          </div>
          <button type="submit" className="btn" data-testid="contact-submit">
            {c.submitBtn}
          </button>
        </form>

        <div data-testid="contact-channels" className="mt-6">
          <p>
            <strong>{locale === 'vi' ? 'Địa chỉ' : 'Address'}:</strong> {b.address}
          </p>
          <p>
            <strong>{locale === 'vi' ? 'Điện thoại' : 'Phone'}:</strong> <a href={`tel:${b.phone}`}>{b.phoneDisplay}</a>
          </p>
          <p>
            <strong>Zalo:</strong>{' '}
            <a href={b.zalo} rel="noopener noreferrer">
              {b.zalo}
            </a>
          </p>
        </div>
      </section>

      <section className="section-block" data-testid="map-block">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-2xl font-bold text-[#0f5838] m-0">{c.mapTitle}</h2>
            <p className="text-sm text-gray-600 mt-1 mb-0">
              <strong>{locale === 'vi' ? 'Toạ độ nhà máy:' : 'Plant coordinates:'}</strong> {b.coordinates} ({b.address}
              )
            </p>
          </div>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.coordinates || '20.930031,106.065651')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary text-sm px-4 py-2"
            data-testid="map-open"
          >
            {locale === 'vi' ? 'Chỉ đường Google Maps ↗' : 'Open in Google Maps ↗'}
          </a>
        </div>
        <div
          data-testid="map-view"
          data-point={b.coordinates}
          className="mt-4 rounded-2xl overflow-hidden border border-[#0f5838]/20 shadow-md bg-white"
        >
          <div className="p-4 bg-[#f8faf7] border-b border-[#0f5838]/10 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-[#0f5838] m-0 text-base">
                {locale === 'vi'
                  ? 'Nhà máy Xử lý & Tái tạo Tài nguyên GMS Hưng Yên'
                  : 'GMS Hung Yen Waste-to-Resource Plant'}
              </p>
              <p className="text-sm text-gray-600 m-0 mt-1">
                <strong>{locale === 'vi' ? 'Địa chỉ:' : 'Address:'}</strong> {b.address}
              </p>
            </div>
            <span className="badge bg-[#0f5838]/10 text-[#0f5838] font-bold">
              {locale === 'vi' ? 'Đang hoạt động' : 'Operational'}
            </span>
          </div>
          <iframe
            title={c.mapTitle}
            src={`https://maps.google.com/maps?q=${encodeURIComponent(b.coordinates || '20.930031,106.065651')}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
            width="100%"
            height="400"
            style={{ border: 0, display: 'block' }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>
    </>
  );
}
