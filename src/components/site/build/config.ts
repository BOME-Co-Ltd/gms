// Cấu hình dựng + dữ liệu dùng chung cho trang (chạy trong tiến trình Next lúc build, và trong bước kiểm sau build).
// Đọc từ biến môi trường vì Next build chạy ở tiến trình con.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { formStatusOf } from '../../../../contracts/build.ts';
import type { LoadedCompany, Locale } from '../../../content/loader.ts';
import { parseSocial } from '../Shell.tsx';

export type SiteConfig = {
  contentDir: string;
  siteUrl: string;
  siteEnv: string;
  contactRecipient: string;
  dateOverride?: string;
};

export function siteConfigFromEnv(cwd: string = process.cwd()): SiteConfig {
  const contentDir =
    process.env.GMS_CONTENT_DIR ??
    (process.env.CONTENT_DIR ? join(cwd, process.env.CONTENT_DIR) : join(cwd, 'content'));
  return {
    contentDir,
    siteUrl: (process.env.SITE_URL ?? 'https://gms.example.test').replace(/\/$/, ''),
    siteEnv: process.env.SITE_ENV ?? 'test',
    contactRecipient: process.env.CONTACT_RECIPIENT !== undefined ? process.env.CONTACT_RECIPIENT : 'lienhe@vi-du.test',
    dateOverride: process.env.DATE_OVERRIDE || undefined,
  };
}

// shortcut: LoadedCompany (loader.ts, lãnh địa backend) chưa mang Company.social; đọc lại từ company.yaml ở đây. Bỏ khi loader xuất `social`.
export function loadSocial(contentDir: string): Array<{ url: string }> {
  const companyYamlPath = join(contentDir, 'company.yaml');
  const rawSocial = existsSync(companyYamlPath)
    ? (parseYaml(readFileSync(companyYamlPath, 'utf8')) as { social?: unknown } | null)?.social
    : undefined;
  return parseSocial(rawSocial);
}

export function currentFormStatus(company: LoadedCompany): ReturnType<typeof formStatusOf> {
  return formStatusOf({
    mailReady: (process.env.CONTACT_MAIL_READY ?? 'false') === 'true',
    privacyRequestEmail: company.privacyRequestEmail?.trim(),
    taxId: company.taxId?.trim(),
  });
}

export function buildOrgJsonLd(company: LoadedCompany, siteUrl: string, locale: Locale = 'vi'): string {
  const org: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: company.legalName || 'GMS',
    url: siteUrl,
  };
  const street = company.address ? company.address[locale] || company.address.vi : '';
  if (street && street.trim() !== '') {
    org.address = { '@type': 'PostalAddress', streetAddress: street.trim(), addressCountry: 'VN' };
  }
  if (company.phone && company.phone.trim() !== '' && !/0000000/.test(company.phone)) {
    org.telephone = company.phone.trim();
  }
  if (company.taxId && company.taxId.trim() !== '' && !/0000000/.test(company.taxId)) {
    org.taxID = company.taxId.trim();
  }
  return JSON.stringify(org);
}
