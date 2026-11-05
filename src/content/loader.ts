import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import MarkdownIt from 'markdown-it';
import { parse as parseYaml } from 'yaml';
import { MAP_POINT } from '../../contracts/content-model.ts';
import { ROUTES } from '../../contracts/routes.ts';
import {
  buildBaseInternalPaths,
  type ContentError,
  isImageAllowedForOg,
  isImageAllowedInBuild,
  type PartnerAssetRef,
  parseSlugsLock,
  readPartnerAsset,
  validateCompanyRaw,
  validateFigureRaw,
  validateImageBinary,
  validateImageMetaRaw,
  validateJourneyStepsRaw,
  validateLinksInBody,
  validateOutputLinesRaw,
  validatePageClaimsAndFigures,
  validatePartnerAssetRefs,
  validatePartnersRaw,
} from './rules/index.ts';

const md = new MarkdownIt({ html: false, linkify: false });

export type Locale = 'vi' | 'en';

export type LoadedCompany = {
  legalName: string | null;
  address: { vi: string; en: string } | null;
  phone: string | null;
  email: string | null;
  zalo: string | null;
  mapImage: string | null;
  mapUrl: string | null;
  // shortcut: tuỳ chọn để literal LoadedCompany trong tests/unit/all.test.ts (ngoài lãnh địa) còn biên dịch; bỏ `?` khi test đó được cập nhật.
  mapPoint?: string | null;
  taxId: string | null;
  privacyRequestEmail: string;
};

export type LoadedImage = {
  name: string;
  relPath: string;
  ext: string;
  bytes: Buffer;
  alt: { vi: string; en: string };
  kind: 'anh-that' | 'anh-dung-ai';
  hasPeople: boolean;
  consentDate: string | null;
  source: string;
  allowedInBuild: boolean;
  allowedForOg: boolean;
  partnerAsset: { partner: string; type: string } | null;
};

export type LoadedFigure = {
  key: string;
  value: string;
  unit: { vi: string; en: string };
  label: { vi: string; en: string };
  source: string;
  confirmedBy: string;
  confirmedAt: string;
  public: boolean;
};

export type LoadedOutputLine = {
  key: string;
  group: 'sang-tuyen' | 'vpd';
  state: 'dinh-huong' | 'da-co';
  name: { vi: string; en: string };
  desc: { vi: string; en: string };
};

export type LoadedPartner = {
  name: string;
  role?: { vi: string; en: string };
  description?: { vi: string; en: string };
  permissionBasis: string;
  allowedAssets: string[];
};

export type LoadedNews = {
  key: string;
  locale: Locale;
  slug: string;
  title: string;
  summary: string;
  date: string;
  published: boolean;
  heroImage: string | null;
  origin: string | null;
  gmsSelected: boolean;
  bodyMd: string;
  bodyHtml: string;
  counterpartSlug?: string;
};

export type LoadedProject = {
  key: string;
  locale: Locale;
  slug: string;
  title: string;
  summary: string;
  date: string;
  category: string;
  published: boolean;
  heroImage: string | null;
  bodyMd: string;
  bodyHtml: string;
  counterpartSlug?: string;
};

export type LoadedJob = {
  key: string;
  locale: Locale;
  slug: string;
  title: string;
  published: boolean;
  validThrough: string;
  employmentType: string;
  bodyMd: string;
  bodyHtml: string;
  counterpartSlug?: string;
};

export type LoadedFaq = {
  key: string;
  order: number;
  question: string;
  answer: string;
};

export type LoadedSolutionItem = {
  key: string;
  locale: Locale;
  slug: string;
  title: string;
  published: boolean;
  bodyMd: string;
  bodyHtml: string;
};

export type LoadedPolicy = {
  version: string;
  effectiveFrom: string;
  locale: Locale;
  bodyMd: string;
  bodyHtml: string;
};

/** content/journey-steps.yaml (content-model.ts JourneyStep). `status` giữ nguyên chuỗi nguồn (đã qua JOURNEY_STATUS_INVALID). */
export type LoadedJourneyStep = {
  order: number;
  name: { vi: string; en: string };
  status: string | null;
};

export type LoadedSiteContent = {
  errors: ContentError[];
  company: LoadedCompany;
  /** null khi không có journey-steps.yaml (trang dùng lộ trình mặc định, không nhãn). Đã sắp theo `order`. */
  journeySteps: LoadedJourneyStep[] | null;
  images: Map<string, LoadedImage>;
  figures: LoadedFigure[];
  outputLines: LoadedOutputLine[];
  partners: LoadedPartner[];
  news: Record<Locale, LoadedNews[]>;
  projects: Record<Locale, LoadedProject[]>;
  jobs: Record<Locale, LoadedJob[]>;
  faq: Record<Locale, LoadedFaq[]>;
  solutionItems: Record<Locale, LoadedSolutionItem[]>;
  policies: Record<Locale, LoadedPolicy[]>;
  pagesBody: Record<string, Record<Locale, { bodyMd: string; bodyHtml: string }>>;
};

function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const parsed = (parseYaml(m[1]) as Record<string, unknown> | null) ?? {};
  return { data: parsed, body: m[2] ?? '' };
}

function getBuildDateVn(dateOverride?: string): string {
  if (dateOverride && /^\d{4}-\d{2}-\d{2}/.test(dateOverride)) {
    return dateOverride.slice(0, 10);
  }
  const vnMs = Date.now() + 7 * 3600 * 1000;
  return new Date(vnMs).toISOString().slice(0, 10);
}

const DEFAULT_OUTPUT_LINES: LoadedOutputLine[] = [
  {
    key: 'nilon',
    group: 'sang-tuyen',
    state: 'dinh-huong',
    name: { vi: 'Nilon tái sinh (nilon)', en: 'Recycled plastic film (nilon)' },
    desc: {
      vi: 'Tách lọc từ nhánh sàng tuyển để đưa vào chu trình tái chế nhựa công nghiệp.',
      en: 'Recovered from the sorting line for industrial plastic recycling.',
    },
  },
  {
    key: 'mun-huu-co',
    group: 'sang-tuyen',
    state: 'dinh-huong',
    name: { vi: 'Mùn hữu cơ', en: 'Organic humus' },
    desc: {
      vi: 'Phân loại và ủ sinh học phục vụ cải tạo đất trồng cây lâm nghiệp và công nghiệp.',
      en: 'Composted organic fraction for soil conditioning and forestry.',
    },
  },
  {
    key: 'rdf',
    group: 'sang-tuyen',
    state: 'dinh-huong',
    name: { vi: 'Viên nhiên liệu RDF', en: 'Refuse-derived fuel (RDF)' },
    desc: {
      vi: 'Nhiên liệu rắn tái chế từ phần chất thải có nhiệt trị cao.',
      en: 'Solid recovered fuel pellets produced from high-calorific fractions.',
    },
  },
  {
    key: 'syngas',
    group: 'vpd',
    state: 'dinh-huong',
    name: { vi: 'Khí tổng hợp (syngas)', en: 'Synthesis gas (syngas)' },
    desc: {
      vi: 'Khí sinh ra từ quá trình phân hủy nhiệt VPD, tuần hoàn cấp nhiệt cho buồng phản ứng.',
      en: 'Gas generated during VPD thermal decomposition, recirculated to heat the reactor.',
    },
  },
  {
    key: 'than-hoat-tinh',
    group: 'vpd',
    state: 'dinh-huong',
    name: { vi: 'Than hoạt tính / than sinh học', en: 'Activated carbon / biochar' },
    desc: {
      vi: 'Cặn cacbon rắn thu hồi sau nhiệt phân VPD dùng trong lọc công nghiệp và cải tạo đất.',
      en: 'Solid carbon residue from VPD pyrolysis for industrial filtration and soil improvement.',
    },
  },
  {
    key: 'dau-tai-che',
    group: 'vpd',
    state: 'dinh-huong',
    name: { vi: 'Dầu tái chế (dầu nhiệt phân)', en: 'Recycled pyrolysis oil' },
    desc: {
      vi: 'Hợp chất lỏng ngưng tụ từ hơi nhiệt phân, làm nguyên liệu đốt công nghiệp.',
      en: 'Condensed liquid hydrocarbon fraction used as industrial fuel feedstock.',
    },
  },
];

const DEFAULT_SOLUTIONS: Record<Locale, LoadedSolutionItem[]> = {
  vi: [
    {
      key: 'tiep-nhan-phan-loai',
      locale: 'vi',
      slug: 'tiep-nhan-phan-loai',
      title: 'Tiếp nhận và sàng tuyển chất thải rắn sinh hoạt',
      published: true,
      bodyMd: 'Tách lọc cơ học theo kích thước, trọng lượng và tính chất vật liệu để thu hồi phế liệu tái chế.',
      bodyHtml:
        '<p>Tách lọc cơ học theo kích thước, trọng lượng và tính chất vật liệu để thu hồi phế liệu tái chế.</p>',
    },
    {
      key: 'xu-ly-nhiet-phan-vpd',
      locale: 'vi',
      slug: 'xu-ly-nhiet-phan-vpd',
      title: 'Xử lý nhiệt phân chân không VPD tạo tài nguyên',
      published: true,
      bodyMd: 'Chuyển hoá phần chất thải khó phân huỷ thành dầu nhiệt phân, than sinh học và khí tuần hoàn.',
      bodyHtml: '<p>Chuyển hoá phần chất thải khó phân huỷ thành dầu nhiệt phân, than sinh học và khí tuần hoàn.</p>',
    },
    {
      key: 'hop-tac-dau-tu-cong-nghe',
      locale: 'vi',
      slug: 'hop-tac-dau-tu-cong-nghe',
      title: 'Hợp tác đầu tư và cung ứng nguyên liệu đầu ra',
      published: true,
      bodyMd: 'Đồng hành cùng địa phương và đối tác công nghiệp trong vận hành và tiêu thụ sản phẩm tái tạo.',
      bodyHtml: '<p>Đồng hành cùng địa phương và đối tác công nghiệp trong vận hành và tiêu thụ sản phẩm tái tạo.</p>',
    },
  ],
  en: [
    {
      key: 'tiep-nhan-phan-loai',
      locale: 'en',
      slug: 'waste-sorting',
      title: 'Municipal solid waste reception and mechanical sorting',
      published: true,
      bodyMd: 'Mechanical separation by size, density and material properties to recover recyclable fractions.',
      bodyHtml:
        '<p>Mechanical separation by size, density and material properties to recover recyclable fractions.</p>',
    },
    {
      key: 'xu-ly-nhiet-phan-vpd',
      locale: 'en',
      slug: 'vpd-pyrolysis',
      title: 'VPD vacuum pyrolysis resource recovery',
      published: true,
      bodyMd: 'Thermal conversion of non-biodegradable fractions into pyrolysis oil, biochar and recirculated gas.',
      bodyHtml:
        '<p>Thermal conversion of non-biodegradable fractions into pyrolysis oil, biochar and recirculated gas.</p>',
    },
    {
      key: 'hop-tac-dau-tu-cong-nghe',
      locale: 'en',
      slug: 'industrial-partnership',
      title: 'Investment partnership and off-take supply',
      published: true,
      bodyMd: 'Collaborating with municipalities and industrial partners on operations and recovered output supply.',
      bodyHtml:
        '<p>Collaborating with municipalities and industrial partners on operations and recovered output supply.</p>',
    },
  ],
};

function renderMarkdownSafe(bodyMd: string, images: Map<string, LoadedImage>, locale: Locale): string {
  // Replace {{figure:key}} tokens if any remain
  const cleaned = bodyMd.replace(/\{\{figure:([a-z0-9-]+)\}\}/gi, '$1').replace(/\bon[a-z]+\s*=/gi, 'data-blocked=');
  let html = md.render(cleaned);
  // Replace image tags referencing images/... with figure + caption if AI image, or strip if disallowed
  html = html.replace(/<img\s+([^>]*?)src="([^"]+)"([^>]*?)>/gi, (_full, pre, src, post) => {
    const cleanSrc = src.replace(/^\//, '');
    const img = images.get(cleanSrc);
    if (img && !img.allowedInBuild) {
      return '';
    }
    const publicSrc = cleanSrc.startsWith('images/') ? `/img/${cleanSrc.slice('images/'.length)}` : `/${cleanSrc}`;
    const altMatch = `${pre} ${post}`.match(/alt="([^"]*)"/i);
    const altText = altMatch?.[1] || (img ? img.alt[locale] : 'Ảnh');
    if (img && img.kind === 'anh-dung-ai') {
      const label = locale === 'vi' ? 'Phối cảnh dự kiến' : "Artist's impression";
      return `<figure class="content-figure"><img src="${publicSrc}" alt="${altText}" width="1200" height="675" loading="lazy" /><figcaption data-testid="photo-label">${label}</figcaption></figure>`;
    }
    return `<img src="${publicSrc}" alt="${altText}" width="1200" height="675" loading="lazy" />`;
  });
  return html;
}

export function loadSiteContent(contentDir: string, dateOverride?: string): LoadedSiteContent {
  const errors: ContentError[] = [];
  const todayVn = getBuildDateVn(dateOverride);

  // 1. company.yaml
  const companyFile = join(contentDir, 'company.yaml');
  let rawCompany: Record<string, unknown> | null = null;
  if (existsSync(companyFile)) {
    rawCompany = (parseYaml(readFileSync(companyFile, 'utf8')) as Record<string, unknown> | null) ?? {};
  }
  errors.push(...validateCompanyRaw(rawCompany));
  const addrObj = rawCompany?.address as Record<string, unknown> | undefined;
  const company: LoadedCompany = {
    legalName:
      typeof rawCompany?.legalName === 'string' && rawCompany.legalName.trim() ? rawCompany.legalName.trim() : null,
    address:
      addrObj && typeof addrObj.vi === 'string' && typeof addrObj.en === 'string'
        ? { vi: addrObj.vi, en: addrObj.en }
        : null,
    phone: typeof rawCompany?.phone === 'string' && rawCompany.phone.trim() ? rawCompany.phone.trim() : null,
    email: typeof rawCompany?.email === 'string' && rawCompany.email.trim() ? rawCompany.email.trim() : null,
    zalo: typeof rawCompany?.zalo === 'string' && rawCompany.zalo.trim() ? rawCompany.zalo.trim() : null,
    mapImage:
      typeof rawCompany?.mapImage === 'string' && rawCompany.mapImage.trim() ? rawCompany.mapImage.trim() : null,
    mapUrl: typeof rawCompany?.mapUrl === 'string' && rawCompany.mapUrl.trim() ? rawCompany.mapUrl.trim() : null,
    // giá trị sai dạng đã báo MAP_POINT_INVALID ở validateCompanyRaw; không chuyển tiếp cho bộ dựng
    mapPoint:
      typeof rawCompany?.mapPoint === 'string' && MAP_POINT.test(rawCompany.mapPoint) ? rawCompany.mapPoint : null,
    taxId: typeof rawCompany?.taxId === 'string' && rawCompany.taxId.trim() ? rawCompany.taxId.trim() : null,
    privacyRequestEmail:
      typeof rawCompany?.privacyRequestEmail === 'string' ? rawCompany.privacyRequestEmail.trim() : '',
  };

  // 2. images/*
  const images = new Map<string, LoadedImage>();
  const partnerAssetRefs: PartnerAssetRef[] = [];
  const imagesDir = join(contentDir, 'images');
  if (existsSync(imagesDir)) {
    const entries = readdirSync(imagesDir);
    const metaFiles = entries.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
    const binFiles = entries.filter((f) => !f.endsWith('.yaml') && !f.endsWith('.yml') && !f.startsWith('.'));

    for (const bf of binFiles) {
      const fullBin = join(imagesDir, bf);
      if (!statSync(fullBin).isFile()) continue;
      const bytes = readFileSync(fullBin);
      errors.push(...validateImageBinary(bf, bytes));
      const baseName = bf.replace(/\.[a-z0-9]+$/i, '');
      const ext = bf.slice(baseName.length + 1).toLowerCase();
      const metaPath = join(imagesDir, `${baseName}.yaml`);
      let metaRaw: Record<string, unknown> | null = null;
      if (existsSync(metaPath)) {
        metaRaw = (parseYaml(readFileSync(metaPath, 'utf8')) as Record<string, unknown> | null) ?? {};
      }
      const metaErrs = validateImageMetaRaw(baseName, metaRaw);
      errors.push(...metaErrs);
      const partnerAsset = readPartnerAsset(metaRaw);
      if (partnerAsset) partnerAssetRefs.push({ image: baseName, ...partnerAsset });
      if (metaRaw && metaErrs.length === 0) {
        const altObj = metaRaw.alt as { vi: string; en: string };
        const relPath = `images/${bf}`;
        images.set(relPath, {
          name: baseName,
          relPath,
          ext,
          bytes,
          alt: { vi: altObj.vi, en: altObj.en },
          kind: metaRaw.kind as 'anh-that' | 'anh-dung-ai',
          hasPeople: Boolean(metaRaw.hasPeople),
          consentDate: typeof metaRaw.consentDate === 'string' ? metaRaw.consentDate : null,
          source: typeof metaRaw.source === 'string' ? metaRaw.source : 'GMS',
          allowedInBuild: isImageAllowedInBuild(metaRaw),
          allowedForOg: isImageAllowedForOg(metaRaw),
          partnerAsset,
        });
      }
    }

    // Also check orphan meta files without binary
    for (const mf of metaFiles) {
      const baseName = mf.replace(/\.ya?ml$/i, '');
      const hasBin = binFiles.some((b) => b.replace(/\.[a-z0-9]+$/i, '') === baseName);
      if (!hasBin) {
        const metaRaw = (parseYaml(readFileSync(join(imagesDir, mf), 'utf8')) as Record<string, unknown> | null) ?? {};
        errors.push(...validateImageMetaRaw(baseName, metaRaw));
        const partnerAsset = readPartnerAsset(metaRaw);
        if (partnerAsset) partnerAssetRefs.push({ image: baseName, ...partnerAsset });
      }
    }
  }

  // 3. figures.yaml
  const figures: LoadedFigure[] = [];
  const figuresByKey = new Map<string, Record<string, unknown>>();
  const figuresPath = join(contentDir, 'figures.yaml');
  if (existsSync(figuresPath)) {
    const rawFigs = (parseYaml(readFileSync(figuresPath, 'utf8')) as Array<Record<string, unknown>> | null) ?? [];
    if (Array.isArray(rawFigs)) {
      for (const rf of rawFigs) {
        figuresByKey.set(String(rf.key ?? ''), rf);
        const figErrs = validateFigureRaw(rf);
        errors.push(...figErrs);
        if (figErrs.length === 0 && rf.public !== false) {
          const unitObj = rf.unit as { vi?: string; en?: string } | undefined;
          const labelObj = rf.label as { vi?: string; en?: string } | undefined;
          figures.push({
            key: String(rf.key),
            value: String(rf.value),
            unit: { vi: unitObj?.vi ?? '', en: unitObj?.en ?? '' },
            label: { vi: labelObj?.vi ?? '', en: labelObj?.en ?? '' },
            source: String(rf.source),
            confirmedBy: String(rf.confirmedBy),
            confirmedAt: String(rf.confirmedAt),
            public: true,
          });
        }
      }
    }
  }

  // 4. partners.yaml
  const partners: LoadedPartner[] = [];
  const partnersPath = join(contentDir, 'partners.yaml');
  let rawPartnerList: Array<Record<string, unknown>> = [];
  if (existsSync(partnersPath)) {
    const rawPartners = (parseYaml(readFileSync(partnersPath, 'utf8')) as Array<Record<string, unknown>> | null) ?? [];
    if (Array.isArray(rawPartners)) {
      rawPartnerList = rawPartners;
      const pErrs = validatePartnersRaw(rawPartners);
      errors.push(...pErrs);
      if (pErrs.length === 0) {
        for (const rp of rawPartners) {
          partners.push({
            name: String(rp.name),
            role: rp.role as LoadedPartner['role'],
            description: rp.description as LoadedPartner['description'],
            permissionBasis: String(rp.permissionBasis).trim(),
            allowedAssets: Array.isArray(rp.allowedAssets) ? rp.allowedAssets.map(String) : [],
          });
        }
      }
    }
  }

  // S33: tư liệu đối tác của ảnh đối chiếu partners.yaml (đủ cả khi không có partners.yaml)
  errors.push(...validatePartnerAssetRefs(partnerAssetRefs, rawPartnerList));

  // 5. output-lines.yaml
  let outputLines: LoadedOutputLine[] = DEFAULT_OUTPUT_LINES;
  const outputLinesPath = join(contentDir, 'output-lines.yaml');
  if (existsSync(outputLinesPath)) {
    const rawLines = (parseYaml(readFileSync(outputLinesPath, 'utf8')) as Array<Record<string, unknown>> | null) ?? [];
    if (Array.isArray(rawLines)) {
      const oErrs = validateOutputLinesRaw(rawLines);
      errors.push(...oErrs);
      if (oErrs.length === 0) {
        outputLines = rawLines.map((rl) => {
          const nameObj = rl.name as { vi?: string; en?: string } | undefined;
          const descObj = rl.desc as { vi?: string; en?: string } | undefined;
          return {
            key: String(rl.key),
            group: rl.group === 'vpd' ? 'vpd' : 'sang-tuyen',
            state: rl.state === 'da-co' ? 'da-co' : 'dinh-huong',
            name: { vi: nameObj?.vi ?? '', en: nameObj?.en ?? '' },
            desc: { vi: descObj?.vi ?? '', en: descObj?.en ?? '' },
          };
        });
      }
    }
  }

  // 6. solutions-items/*.md
  const solutionItems: Record<Locale, LoadedSolutionItem[]> = {
    vi: [...DEFAULT_SOLUTIONS.vi],
    en: [...DEFAULT_SOLUTIONS.en],
  };
  const solDir = join(contentDir, 'solutions-items');
  if (existsSync(solDir)) {
    const files = readdirSync(solDir).filter((f) => f.endsWith('.md'));
    const byKey = new Map<string, Partial<Record<Locale, { data: Record<string, unknown>; body: string }>>>();
    for (const f of files) {
      const m = f.match(/^(.+)\.(vi|en)\.md$/);
      if (!m) continue;
      const [, key, loc] = m as [string, string, Locale];
      const parsed = parseFrontmatter(readFileSync(join(solDir, f), 'utf8'));
      const entry = byKey.get(key) ?? {};
      entry[loc] = parsed;
      byKey.set(key, entry);
    }
    const customVi: LoadedSolutionItem[] = [];
    const customEn: LoadedSolutionItem[] = [];
    for (const [key, pair] of byKey.entries()) {
      const viDoc = pair.vi;
      const enDoc = pair.en;
      if (viDoc && viDoc.data.published !== false && !enDoc) {
        errors.push({
          code: 'SOLUTIONS_MISSING_EN',
          message: `Trang Giải pháp (solutions): mục "${String(viDoc.data.title ?? key)}" thiếu bản en`,
        });
        continue;
      }
      if (viDoc && enDoc && viDoc.data.published !== false && enDoc.data.published !== false) {
        customVi.push({
          key,
          locale: 'vi',
          slug: String(viDoc.data.slug ?? key),
          title: String(viDoc.data.title ?? key),
          published: true,
          bodyMd: viDoc.body,
          bodyHtml: renderMarkdownSafe(viDoc.body, images, 'vi'),
        });
        customEn.push({
          key,
          locale: 'en',
          slug: String(enDoc.data.slug ?? key),
          title: String(enDoc.data.title ?? key),
          published: true,
          bodyMd: enDoc.body,
          bodyHtml: renderMarkdownSafe(enDoc.body, images, 'en'),
        });
      }
    }
    if (customVi.length > 0) {
      solutionItems.vi = customVi;
      solutionItems.en = customEn;
    }
  }

  // 7. policy/*.md
  const policies: Record<Locale, LoadedPolicy[]> = { vi: [], en: [] };
  const policyDir = join(contentDir, 'policy');
  if (existsSync(policyDir)) {
    const files = readdirSync(policyDir).filter((f) => f.endsWith('.md'));
    const byVer = new Map<string, Partial<Record<Locale, { data: Record<string, unknown>; body: string }>>>();
    for (const f of files) {
      const m = f.match(/^(.+)\.(vi|en)\.md$/);
      if (!m) continue;
      const [, verKey, loc] = m as [string, string, Locale];
      const parsed = parseFrontmatter(readFileSync(join(policyDir, f), 'utf8'));
      const entry = byVer.get(verKey) ?? {};
      entry[loc] = parsed;
      byVer.set(verKey, entry);
    }
    for (const [verKey, pair] of byVer.entries()) {
      if (pair.vi && !pair.en) {
        errors.push({
          code: 'POLICY_MISSING_EN',
          message: `Chính sách bảo mật ${String(pair.vi.data.version ?? verKey)}: thiếu bản en`,
        });
        continue;
      }
      if (pair.vi && pair.en) {
        for (const loc of ['vi', 'en'] as Locale[]) {
          const doc = pair[loc]!;
          policies[loc].push({
            version: String(doc.data.version ?? verKey),
            effectiveFrom: String(doc.data.effectiveFrom ?? '2026-01-01'),
            locale: loc,
            bodyMd: doc.body,
            bodyHtml: renderMarkdownSafe(doc.body, images, loc),
          });
        }
      }
    }
  }

  // 8. news/*.md
  const news: Record<Locale, LoadedNews[]> = { vi: [], en: [] };
  const newsDir = join(contentDir, 'news');
  const seenFanpageOrigins = new Set<string>();
  const allNewsSlugs = new Map<string, string>(); // `news/<key>.<locale>` -> slug

  if (existsSync(newsDir)) {
    const files = readdirSync(newsDir).filter((f) => f.endsWith('.md'));
    const byKey = new Map<string, Partial<Record<Locale, { data: Record<string, unknown>; body: string }>>>();
    for (const f of files) {
      const m = f.match(/^(.+)\.(vi|en)\.md$/);
      if (!m) continue;
      const [, key, loc] = m as [string, string, Locale];
      const parsed = parseFrontmatter(readFileSync(join(newsDir, f), 'utf8'));
      const entry = byKey.get(key) ?? {};
      entry[loc] = parsed;
      byKey.set(key, entry);
    }

    for (const [key, pair] of byKey.entries()) {
      const viDoc = pair.vi;
      const enDoc = pair.en;
      const viPub = viDoc ? viDoc.data.published !== false : false;
      const enPub = enDoc ? enDoc.data.published !== false : false;

      if (viDoc) allNewsSlugs.set(`news/${key}.vi`, String(viDoc.data.slug ?? `${key}-vi`));
      if (enDoc) allNewsSlugs.set(`news/${key}.en`, String(enDoc.data.slug ?? `${key}-en`));

      const origin = (viDoc?.data.origin ?? enDoc?.data.origin) as string | undefined;
      if (origin) {
        if (seenFanpageOrigins.has(origin)) {
          errors.push({
            code: 'DUPLICATE_FANPAGE_ORIGIN',
            message: `Tin "${key}": nguồn gốc nhập từ fanpage bài ${origin} bị trùng`,
          });
        }
        seenFanpageOrigins.add(origin);
      }

      if (viDoc && viPub && !enDoc) {
        errors.push({
          code: 'NEWS_MISSING_EN',
          message: `Tin "${String(viDoc.data.title ?? key)}": thiếu bản en`,
        });
        continue;
      }
      if (!viDoc || !enDoc || !viPub || !enPub) {
        continue;
      }

      const gmsSelected = Boolean(viDoc.data.gmsSelected ?? enDoc.data.gmsSelected);
      if (origin && !gmsSelected) {
        continue;
      }

      const viSlug = String(viDoc.data.slug ?? `${key}-vi`);
      const enSlug = String(enDoc.data.slug ?? `${key}-en`);

      for (const [loc, doc, slug, otherSlug] of [
        ['vi', viDoc, viSlug, enSlug],
        ['en', enDoc, enSlug, viSlug],
      ] as const) {
        errors.push(...validatePageClaimsAndFigures(`news/${key}.${loc}`, doc.body, figuresByKey));
        let heroImage = typeof doc.data.heroImage === 'string' ? doc.data.heroImage : null;
        if (heroImage) {
          const imgMeta = images.get(heroImage);
          if (imgMeta && !imgMeta.allowedInBuild) {
            heroImage = null;
          }
        }
        news[loc].push({
          key,
          locale: loc,
          slug,
          title: String(doc.data.title ?? key),
          summary: String(doc.data.summary ?? ''),
          date: String(doc.data.date ?? '2026-10-01'),
          published: true,
          heroImage,
          origin: origin ?? null,
          gmsSelected,
          bodyMd: doc.body,
          bodyHtml: renderMarkdownSafe(doc.body, images, loc),
          counterpartSlug: otherSlug,
        });
      }
    }
  }

  news.vi.sort((a, b) => b.date.localeCompare(a.date) || b.key.localeCompare(a.key));
  news.en.sort((a, b) => b.date.localeCompare(a.date) || b.key.localeCompare(a.key));

  // 9. projects/*.md
  const projects: Record<Locale, LoadedProject[]> = { vi: [], en: [] };
  const projDir = join(contentDir, 'projects');
  if (existsSync(projDir)) {
    const files = readdirSync(projDir).filter((f) => f.endsWith('.md'));
    const byKey = new Map<string, Partial<Record<Locale, { data: Record<string, unknown>; body: string }>>>();
    for (const f of files) {
      const m = f.match(/^(.+)\.(vi|en)\.md$/);
      if (!m) continue;
      const [, key, loc] = m as [string, string, Locale];
      const parsed = parseFrontmatter(readFileSync(join(projDir, f), 'utf8'));
      const entry = byKey.get(key) ?? {};
      entry[loc] = parsed;
      byKey.set(key, entry);
    }
    for (const [key, pair] of byKey.entries()) {
      const viDoc = pair.vi;
      const enDoc = pair.en;
      if (viDoc && viDoc.data.published !== false && !enDoc) {
        errors.push({
          code: 'PROJECT_MISSING_EN',
          message: `Dự án "${String(viDoc.data.title ?? key)}": thiếu bản en`,
        });
        continue;
      }
      if (!viDoc || !enDoc || viDoc.data.published === false || enDoc.data.published === false) continue;
      const viSlug = String(viDoc.data.slug ?? `${key}-vi`);
      const enSlug = String(enDoc.data.slug ?? `${key}-en`);
      for (const [loc, doc, slug, otherSlug] of [
        ['vi', viDoc, viSlug, enSlug],
        ['en', enDoc, enSlug, viSlug],
      ] as const) {
        errors.push(...validatePageClaimsAndFigures(`projects/${key}.${loc}`, doc.body, figuresByKey));
        let heroImage = typeof doc.data.heroImage === 'string' ? doc.data.heroImage : null;
        if (heroImage && images.get(heroImage) && !images.get(heroImage)!.allowedInBuild) {
          heroImage = null;
        }
        projects[loc].push({
          key,
          locale: loc,
          slug,
          title: String(doc.data.title ?? key),
          summary: String(doc.data.summary ?? ''),
          date: String(doc.data.date ?? '2026-10-01'),
          category: String(doc.data.category ?? 'Dự án'),
          published: true,
          heroImage,
          bodyMd: doc.body,
          bodyHtml: renderMarkdownSafe(doc.body, images, loc),
          counterpartSlug: otherSlug,
        });
      }
    }
  }
  projects.vi.sort((a, b) => b.date.localeCompare(a.date) || b.key.localeCompare(a.key));
  projects.en.sort((a, b) => b.date.localeCompare(a.date) || b.key.localeCompare(a.key));

  // 10. jobs/*.md
  const jobs: Record<Locale, LoadedJob[]> = { vi: [], en: [] };
  const jobsDir = join(contentDir, 'jobs');
  if (existsSync(jobsDir)) {
    const files = readdirSync(jobsDir).filter((f) => f.endsWith('.md'));
    const byKey = new Map<string, Partial<Record<Locale, { data: Record<string, unknown>; body: string }>>>();
    for (const f of files) {
      const m = f.match(/^(.+)\.(vi|en)\.md$/);
      if (!m) continue;
      const [, key, loc] = m as [string, string, Locale];
      const parsed = parseFrontmatter(readFileSync(join(jobsDir, f), 'utf8'));
      const entry = byKey.get(key) ?? {};
      entry[loc] = parsed;
      byKey.set(key, entry);
    }
    for (const [key, pair] of byKey.entries()) {
      const viDoc = pair.vi;
      const enDoc = pair.en;
      if (viDoc && viDoc.data.published !== false && !enDoc) {
        errors.push({
          code: 'JOB_MISSING_EN',
          message: `Tuyển dụng "${String(viDoc.data.title ?? key)}": thiếu bản en`,
        });
        continue;
      }
      if (!viDoc || !enDoc || viDoc.data.published === false || enDoc.data.published === false) continue;
      const validThrough = String(viDoc.data.validThrough ?? enDoc.data.validThrough ?? '2099-12-31');
      if (validThrough < todayVn) {
        // Expired job => excluded from build & sitemap (SEO-09 / PAGE-12)
        continue;
      }
      const viSlug = String(viDoc.data.slug ?? key);
      const enSlug = String(enDoc.data.slug ?? key);
      for (const [loc, doc, slug, otherSlug] of [
        ['vi', viDoc, viSlug, enSlug],
        ['en', enDoc, enSlug, viSlug],
      ] as const) {
        jobs[loc].push({
          key,
          locale: loc,
          slug,
          title: String(doc.data.title ?? key),
          published: true,
          validThrough,
          employmentType: String(doc.data.employmentType ?? 'FULL_TIME'),
          bodyMd: doc.body,
          bodyHtml: renderMarkdownSafe(doc.body, images, loc),
          counterpartSlug: otherSlug,
        });
      }
    }
  }

  // 11. faq.<locale>.yaml
  const faq: Record<Locale, LoadedFaq[]> = { vi: [], en: [] };
  for (const loc of ['vi', 'en'] as Locale[]) {
    const fp = join(contentDir, `faq.${loc}.yaml`);
    if (existsSync(fp)) {
      const rawFaq = (parseYaml(readFileSync(fp, 'utf8')) as Array<Record<string, unknown>> | null) ?? [];
      if (Array.isArray(rawFaq)) {
        faq[loc] = rawFaq
          .map((item) => ({
            key: String(item.key ?? ''),
            order: Number(item.order ?? 0),
            question: String(item.question ?? ''),
            answer: String(item.answer ?? ''),
          }))
          .sort((a, b) => a.order - b.order);
      }
    }
  }

  // 12. pages/*.md
  const pagesBody: Record<string, Record<Locale, { bodyMd: string; bodyHtml: string }>> = {};
  const pagesDir = join(contentDir, 'pages');
  if (existsSync(pagesDir)) {
    const files = readdirSync(pagesDir).filter((f) => f.endsWith('.md'));
    for (const f of files) {
      const m = f.match(/^(.+)\.(vi|en)\.md$/);
      if (!m) continue;
      const [, pageKey, loc] = m as [string, string, Locale];
      const parsed = parseFrontmatter(readFileSync(join(pagesDir, f), 'utf8'));
      errors.push(...validatePageClaimsAndFigures(`pages/${pageKey}.${loc}`, parsed.body, figuresByKey));
      if (!pagesBody[pageKey]) {
        pagesBody[pageKey] = {
          vi: { bodyMd: '', bodyHtml: '' },
          en: { bodyMd: '', bodyHtml: '' },
        };
      }
      pagesBody[pageKey][loc] = {
        bodyMd: parsed.body,
        bodyHtml: renderMarkdownSafe(parsed.body, images, loc),
      };
    }
  }

  // 12b. journey-steps.yaml (S12): lộ trình 5 bước, trạng thái kiểm theo JOURNEY_STATUSES
  let journeySteps: LoadedJourneyStep[] | null = null;
  const journeyPath = join(contentDir, 'journey-steps.yaml');
  if (existsSync(journeyPath)) {
    const rawSteps = parseYaml(readFileSync(journeyPath, 'utf8')) as unknown;
    if (Array.isArray(rawSteps)) {
      errors.push(...validateJourneyStepsRaw(rawSteps));
      journeySteps = rawSteps
        .map((rs, idx) => {
          const o = (rs && typeof rs === 'object' ? rs : {}) as Record<string, unknown>;
          const nameObj = o.name as { vi?: unknown; en?: unknown } | undefined;
          return {
            order: typeof o.order === 'number' ? o.order : idx + 1,
            name: { vi: String(nameObj?.vi ?? ''), en: String(nameObj?.en ?? '') },
            status: o.status === undefined || o.status === null ? null : String(o.status),
          };
        })
        .sort((a, b) => a.order - b.order);
    }
  }

  // 13. Build valid internal paths set & check all markdown links (BUILD-02, NEWS-08)
  const validPaths = buildBaseInternalPaths();
  for (const n of news.vi) validPaths.add(`/tin-tuc/${n.slug}`);
  for (const n of news.en) validPaths.add(`/en/news/${n.slug}`);
  for (const p of projects.vi) validPaths.add(`/du-an-thu-vien/${p.slug}`);
  for (const p of projects.en) validPaths.add(`/en/projects-library/${p.slug}`);
  for (const j of jobs.vi) validPaths.add(`/tuyen-dung/${j.slug}`);
  for (const j of jobs.en) validPaths.add(`/en/careers/${j.slug}`);

  for (const loc of ['vi', 'en'] as Locale[]) {
    for (const n of news[loc]) {
      errors.push(...validateLinksInBody(`news/${n.key}.${loc}`, n.bodyMd, validPaths));
    }
    for (const p of projects[loc]) {
      errors.push(...validateLinksInBody(`projects/${p.key}.${loc}`, p.bodyMd, validPaths));
    }
    for (const j of jobs[loc]) {
      errors.push(...validateLinksInBody(`jobs/${j.key}.${loc}`, j.bodyMd, validPaths));
    }
  }
  for (const [pageKey, locMap] of Object.entries(pagesBody)) {
    for (const loc of ['vi', 'en'] as Locale[]) {
      if (locMap[loc]?.bodyMd) {
        errors.push(...validateLinksInBody(`pages/${pageKey}.${loc}`, locMap[loc].bodyMd, validPaths));
      }
    }
  }

  // 14. Check slugs.lock (BUILD-01)
  const lockPath = join(contentDir, 'slugs.lock');
  if (existsSync(lockPath)) {
    const lockMap = parseSlugsLock(readFileSync(lockPath, 'utf8'));
    for (const [lockKey, oldSlug] of lockMap.entries()) {
      const currentSlug = allNewsSlugs.get(lockKey);
      if (currentSlug && currentSlug !== oldSlug) {
        errors.push({
          code: 'SLUG_LOCK_CHANGED',
          message: `slug đổi so với slugs.lock tại ${lockKey}: slug cũ "${oldSlug}" -> slug mới "${currentSlug}"`,
        });
      }
    }
  }

  return {
    errors,
    company,
    journeySteps,
    images,
    figures,
    outputLines,
    partners,
    news,
    projects,
    jobs,
    faq,
    solutionItems,
    policies,
    pagesBody,
  };
}

export { ROUTES };
