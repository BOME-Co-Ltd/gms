import { CONTENT_RULE_MESSAGES } from '../../../contracts/build.ts';
import {
  ALL_IMAGE_SLOTS,
  ComparisonTable,
  HOME_IMAGE_SLOT_KIND,
  HOME_IMAGE_SLOTS,
  IMAGE_LIMITS,
  ImageMeta,
  JOURNEY_STATUSES,
  MAP_POINT,
} from '../../../contracts/content-model.ts';
import { ROUTES } from '../../../contracts/routes.ts';
import { safeHref } from '../../../contracts/safe-url.ts';
import { isValidPublicVNPhone } from '../../shared/contact/schema.ts';

export type ContentError = {
  code: string;
  message: string;
};

export const BANNED_ENVIRONMENTAL_CLAIMS: Array<{ re: RegExp; label: string }> = [
  { re: /tiệm cận không phát thải/i, label: 'tiệm cận không phát thải' },
  { re: /không phát thải/i, label: 'không phát thải' },
  { re: /zero[- ]emission/i, label: 'zero-emission' },
  { re: /giảm hơn 90\s?%/i, label: 'giảm hơn 90%' },
  { re: />\s?90\s?%/i, label: '> 90%' },
];

export function detectImageMime(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export function validateImageBinary(filename: string, bytes: Uint8Array): ContentError[] {
  const errors: ContentError[] = [];
  const mime = detectImageMime(bytes);
  if (!mime || !(IMAGE_LIMITS.types as readonly string[]).includes(mime)) {
    errors.push({
      code: 'IMAGE_BAD_TYPE',
      message: `${filename}: loại tệp không cho phép (chỉ nhận JPEG, PNG, WebP)`,
    });
  }
  if (bytes.byteLength > IMAGE_LIMITS.maxBytes) {
    errors.push({
      code: 'IMAGE_TOO_LARGE',
      message: `${filename}: vượt trần dung lượng (${bytes.byteLength} > ${IMAGE_LIMITS.maxBytes} byte)`,
    });
  }
  return errors;
}

const IMAGE_META_KEYS: readonly string[] = Object.keys(ImageMeta.shape);

export function validateImageMetaRaw(name: string, meta: Record<string, unknown> | null): ContentError[] {
  const errors: ContentError[] = [];
  if (!meta) {
    errors.push({ code: 'IMAGE_META_MISSING', message: `${name}: thiếu metadata ảnh` });
    return errors;
  }
  // ImageMeta là `.strict()`: khoá lạ (gồm khoá cũ partnerAsset/techSourceAsset/keepTitleBlock) ⇒ build đỏ, không bỏ qua.
  for (const key of Object.keys(meta)) {
    if (!IMAGE_META_KEYS.includes(key)) {
      errors.push({
        code: 'IMAGE_META_KEY_UNKNOWN',
        message: `${name}: metadata ảnh có khoá "${key}" không thuộc mô hình ảnh (content-model.ts ImageMeta)`,
      });
    }
  }
  if (meta.kind !== 'anh-that' && meta.kind !== 'anh-dung-ai') {
    errors.push({
      code: 'IMAGE_KIND_MISSING',
      message: `${name}: thiếu loại ảnh (Ảnh chụp thật hoặc Ảnh dựng/AI)`,
    });
  }
  if (typeof meta.hasPeople !== 'boolean') {
    errors.push({
      code: 'IMAGE_HAS_PEOPLE_MISSING',
      message: `${name}: thiếu trường có người nhận diện được (hasPeople)`,
    });
  }
  const alt = meta.alt as Record<string, unknown> | undefined;
  const altVi = typeof alt?.vi === 'string' ? alt.vi.trim() : '';
  const altEn = typeof alt?.en === 'string' ? alt.en.trim() : '';
  if (!altVi || !altEn) {
    errors.push({
      code: 'IMAGE_ALT_EMPTY',
      message: `${name}: thiếu mô tả thay thế (alt) không rỗng cho ảnh`,
    });
  }
  return errors;
}

export function isImageAllowedInBuild(meta: Record<string, unknown>): boolean {
  if (meta.hasPeople === true && (!meta.consentDate || String(meta.consentDate).trim() === '')) {
    return false;
  }
  return true;
}

export function isImageAllowedForOg(meta: Record<string, unknown>): boolean {
  if (meta.kind === 'anh-dung-ai') return false;
  if (meta.hasPeople === true && (!meta.consentDate || String(meta.consentDate).trim() === '')) {
    return false;
  }
  return true;
}

export function validateFigureRaw(fig: Record<string, unknown>): ContentError[] {
  const errors: ContentError[] = [];
  const labelObj = fig.label as Record<string, unknown> | undefined;
  const labelVi = typeof labelObj?.vi === 'string' ? labelObj.vi : String(fig.key ?? 'Số liệu');
  const source = typeof fig.source === 'string' ? fig.source.trim() : '';
  const confirmedBy = typeof fig.confirmedBy === 'string' ? fig.confirmedBy.trim() : '';
  const confirmedAt = typeof fig.confirmedAt === 'string' ? fig.confirmedAt.trim() : '';
  if (!source) {
    errors.push({
      code: 'FIGURE_SOURCE_MISSING',
      message: `Số liệu "${labelVi}" (${String(fig.key ?? '')}): thiếu trường tên tài liệu nguồn`,
    });
  }
  if (!confirmedBy || !confirmedAt) {
    errors.push({
      code: 'FIGURE_CONFIRM_MISSING',
      message: `Số liệu "${labelVi}" (${String(fig.key ?? '')}): thiếu người xác nhận hoặc ngày xác nhận`,
    });
  }
  return errors;
}

const HOME_SLOT_SET: readonly string[] = Object.values(HOME_IMAGE_SLOTS);

/**
 * Ô ảnh cố định (content-model.ts ALL_IMAGE_SLOTS). `imageFiles` = tên tệp (không đường dẫn) trong content/images/, không
 * kể .yaml; `metaByBase` = meta thô theo basename. Trùng basename khác đuôi ⇒ IMAGE_SLOT_DUPLICATE; ô trang chủ có tệp mà
 * kind ≠ HOME_IMAGE_SLOT_KIND ⇒ IMAGE_SLOT_KIND_INVALID. Thiếu tệp ⇒ không lỗi (ô ẩn).
 */
export function validateImageSlots(
  imageFiles: string[],
  metaByBase: Map<string, Record<string, unknown> | null>,
): ContentError[] {
  const errors: ContentError[] = [];
  for (const slot of ALL_IMAGE_SLOTS) {
    const files = imageFiles.filter((f) => f.replace(/\.[a-z0-9]+$/i, '') === slot).sort();
    if (files.length > 1) {
      errors.push({
        code: 'IMAGE_SLOT_DUPLICATE',
        message: CONTENT_RULE_MESSAGES.IMAGE_SLOT_DUPLICATE({ slot, files: files.map((f) => `images/${f}`) }),
      });
      continue;
    }
    const file = files[0];
    if (file === undefined || !HOME_SLOT_SET.includes(slot)) continue;
    const kind = metaByBase.get(slot)?.kind;
    if ((kind === 'anh-that' || kind === 'anh-dung-ai') && kind !== HOME_IMAGE_SLOT_KIND) {
      errors.push({
        code: 'IMAGE_SLOT_KIND_INVALID',
        message: CONTENT_RULE_MESSAGES.IMAGE_SLOT_KIND_INVALID({ slot, file: `images/${file}`, kind }),
      });
    }
  }
  return errors;
}

export function validateOutputLinesRaw(items: Array<Record<string, unknown>>): ContentError[] {
  const errors: ContentError[] = [];
  for (const item of items) {
    const nameObj = item.name as Record<string, unknown> | undefined;
    const nameVi = typeof nameObj?.vi === 'string' ? nameObj.vi : String(item.key ?? 'Dòng đầu ra');
    if (item.state !== 'dinh-huong' && item.state !== 'da-co') {
      errors.push({
        code: 'OUTPUT_LINE_STATE_MISSING',
        message: `${nameVi}: chưa khai trạng thái Định hướng hay Đã có`,
      });
    }
  }
  return errors;
}

const JOURNEY_STATUS_SET: readonly string[] = JOURNEY_STATUSES;

/** news-and-journey.feature dòng 23–26: `status` của bước (nếu có) phải thuộc JOURNEY_STATUSES; bước đánh số từ `order`. */
export function validateJourneyStepsRaw(steps: unknown[]): ContentError[] {
  const errors: ContentError[] = [];
  steps.forEach((raw, idx) => {
    const step = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    if (step.status === undefined || step.status === null) return;
    const status = String(step.status);
    if (JOURNEY_STATUS_SET.includes(status)) return;
    const order = typeof step.order === 'number' ? step.order : idx + 1;
    errors.push({
      code: 'JOURNEY_STATUS_INVALID',
      message: CONTENT_RULE_MESSAGES.JOURNEY_STATUS_INVALID({ step: order, status }),
    });
  });
  return errors;
}

/**
 * content/comparison-tables.yaml = ComparisonTable[] (content-model.ts; tuỳ chọn — thiếu tệp thì không gọi hàm này).
 * Mã theo contract build.ts §8: COMPARISON_SHAPE (số ô ≠ số cột), COMPARISON_NUMBER_NOT_FIGURE (chữ số trong ô chữ),
 * COMPARISON_ROW_SOURCE_MISSING (ô figure trỏ Số liệu thiếu key/source). Gom hết lỗi, không dừng ở lỗi đầu.
 * Lỗi schema chung (khoá lạ `.strict()`, ô sai dạng, chuỗi rỗng, thiếu trường, gốc không phải mảng, key trùng) ⇒
 * COMPARISON_SCHEMA_INVALID (contract build.ts §8, lượt 18); số ô ≠ số cột CHỈ ra COMPARISON_SHAPE.
 */
export function validateComparisonTablesRaw(
  raw: unknown,
  figuresByKey: Map<string, Record<string, unknown>>,
): ContentError[] {
  const errors: ContentError[] = [];
  const shape = (table: string, row: string) =>
    errors.push({ code: 'COMPARISON_SHAPE', message: CONTENT_RULE_MESSAGES.COMPARISON_SHAPE({ table, row }) });
  const schemaInvalid = (table: string, row: string, detail: string) =>
    errors.push({
      code: 'COMPARISON_SCHEMA_INVALID',
      message: CONTENT_RULE_MESSAGES.COMPARISON_SCHEMA_INVALID({ table, row, detail }),
    });
  if (raw === null || raw === undefined) return errors; // tệp rỗng = không bảng
  if (!Array.isArray(raw)) {
    schemaInvalid('(gốc tệp)', '-', 'phải là danh sách bảng');
    return errors;
  }
  const seenKeys = new Set<string>();
  raw.forEach((rt, ti) => {
    const t = (rt && typeof rt === 'object' ? rt : {}) as Record<string, unknown>;
    const titleObj = t.title as Record<string, unknown> | undefined;
    const table =
      typeof titleObj?.vi === 'string' && titleObj.vi.trim() ? titleObj.vi : String(t.key ?? `#${ti + 1}`);
    // Schema: parse cả bảng, mỗi vấn đề → một lỗi (trừ số ô ≠ số cột, xử lý riêng bên dưới để ra đúng thông báo contract).
    const parsed = ComparisonTable.safeParse(rt);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const rowIdx = issue.path[0] === 'rows' && typeof issue.path[1] === 'number' ? issue.path[1] : null;
        const rowLabel =
          rowIdx === null
            ? '-'
            : String(((t.rows as Array<{ label?: { vi?: unknown } }>)?.[rowIdx]?.label?.vi as string) ?? `#${rowIdx + 1}`);
        schemaInvalid(table, rowLabel, `${issue.path.join('.') || '(bảng)'}: ${issue.message}`);
      }
    }
    const key = typeof t.key === 'string' ? t.key : null;
    if (key !== null) {
      if (seenKeys.has(key)) schemaInvalid(table, '-', `key "${key}" trùng`);
      seenKeys.add(key);
    }
    const columns = Array.isArray(t.columns) ? t.columns : null;
    const rows = Array.isArray(t.rows) ? t.rows : [];
    rows.forEach((rr, ri) => {
      const r = (rr && typeof rr === 'object' ? rr : {}) as Record<string, unknown>;
      const labelObj = r.label as Record<string, unknown> | undefined;
      const row = typeof labelObj?.vi === 'string' && labelObj.vi.trim() ? labelObj.vi : `#${ri + 1}`;
      const cells = Array.isArray(r.cells) ? r.cells : null;
      if (columns && cells && cells.length !== columns.length) shape(table, row);
      let sourceMissing = false;
      for (const rc of cells ?? []) {
        const c = (rc && typeof rc === 'object' ? rc : {}) as Record<string, unknown>;
        if (typeof c.figure === 'string') {
          const fig = figuresByKey.get(c.figure);
          if (!fig || typeof fig.source !== 'string' || fig.source.trim() === '') sourceMissing = true;
        } else if (c.text && typeof c.text === 'object') {
          const tx = c.text as Record<string, unknown>;
          if ([tx.vi, tx.en].some((v) => typeof v === 'string' && /\d/.test(v))) {
            errors.push({
              code: 'COMPARISON_NUMBER_NOT_FIGURE',
              message: CONTENT_RULE_MESSAGES.COMPARISON_NUMBER_NOT_FIGURE({ table, row }),
            });
          }
        }
      }
      if (sourceMissing) {
        errors.push({
          code: 'COMPARISON_ROW_SOURCE_MISSING',
          message: CONTENT_RULE_MESSAGES.COMPARISON_ROW_SOURCE_MISSING({ table, row }),
        });
      }
    });
  });
  return errors;
}

export function validateCompanyRaw(company: Record<string, unknown> | null): ContentError[] {
  const errors: ContentError[] = [];
  if (!company) {
    errors.push({ code: 'COMPANY_MISSING', message: 'Thiếu tệp company.yaml' });
    return errors;
  }
  // V14 (build.ts §9): thiếu email ⇒ build XANH, form tạm đóng (reason no-privacy-email). Đã khai thì phải đúng dạng.
  const rawEmail = company.privacyRequestEmail;
  const privacyEmail = typeof rawEmail === 'string' ? rawEmail.trim() : '';
  const declared = rawEmail !== undefined && rawEmail !== null && (typeof rawEmail !== 'string' || privacyEmail !== '');
  if (declared && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(privacyEmail)) {
    errors.push({
      code: 'PRIVACY_EMAIL_INVALID',
      message: 'company.yaml: email nhận yêu cầu về dữ liệu (privacyRequestEmail) không đúng dạng địa chỉ email',
    });
  }
  if (company.phone !== undefined && company.phone !== null && String(company.phone).trim() !== '') {
    const phoneStr = String(company.phone).trim();
    if (!isValidPublicVNPhone(phoneStr)) {
      errors.push({
        code: 'INVALID_PUBLIC_PHONE',
        message: `company.yaml: số điện thoại công khai "${phoneStr}" không phải số điện thoại Việt Nam hợp lệ`,
      });
    }
  }
  // content-model.ts Company.mapPoint: thiếu ⇒ không có khối bản đồ; đã khai thì phải đúng MAP_POINT.
  const rawPoint = company.mapPoint;
  if (rawPoint !== undefined && rawPoint !== null && (typeof rawPoint !== 'string' || !MAP_POINT.test(rawPoint))) {
    errors.push({
      code: 'MAP_POINT_INVALID',
      message: CONTENT_RULE_MESSAGES.MAP_POINT_INVALID(),
    });
  }
  return errors;
}

const ROW_LABEL_VI: Record<string, string> = {
  dot: 'đốt',
  'nhiet-phan': 'nhiệt phân',
  'chon-lap': 'chôn lấp',
  'u-compost': 'ủ compost',
};

export function validatePageClaimsAndFigures(
  pageIdentifier: string,
  markdownBody: string,
  figuresByKey: Map<string, Record<string, unknown>>,
): ContentError[] {
  const errors: ContentError[] = [];
  for (const claim of BANNED_ENVIRONMENTAL_CLAIMS) {
    if (claim.re.test(markdownBody)) {
      errors.push({
        code: 'UNVERIFIED_ENVIRONMENTAL_CLAIM',
        message: `Trang ${pageIdentifier}: chứa cụm tuyên bố môi trường chưa nguồn "${claim.label}"`,
      });
    }
  }
  // Check {{figure:key}} references (e.g. in comparison table)
  const matches = [...markdownBody.matchAll(/\{\{figure:([a-z0-9-]+)\}\}/gi)];
  for (const m of matches) {
    const figKey = m[1];
    const fig = figuresByKey.get(figKey);
    const suffix = figKey.replace(/^so-sanh-/, '');
    const rowLabel = ROW_LABEL_VI[suffix] ?? suffix;
    if (!fig || typeof fig.source !== 'string' || fig.source.trim() === '') {
      errors.push({
        code: 'COMPARISON_TABLE_MISSING_SOURCE',
        message: `Trang ${pageIdentifier}: bảng so sánh, dòng "${rowLabel}" (${figKey}) thiếu nguồn`,
      });
    }
  }
  return errors;
}

export function extractMarkdownLinks(markdownBody: string): string[] {
  const out: string[] = [];
  const re = /(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const m of markdownBody.matchAll(re)) {
    out.push(m[1]);
  }
  return out;
}

export function validateLinksInBody(
  docId: string,
  markdownBody: string,
  validInternalPaths: Set<string>,
): ContentError[] {
  const errors: ContentError[] = [];
  const hrefs = extractMarkdownLinks(markdownBody);
  for (const rawHref of hrefs) {
    if (rawHref.toLowerCase().startsWith('mailto:')) {
      const check = safeHref(rawHref);
      if (!check.ok) {
        errors.push({
          code: 'UNSAFE_MAILTO',
          message: `${docId}: liên kết mailto không hợp lệ hoặc chứa tham số không cho phép (${rawHref})`,
        });
      }
      continue;
    }
    const check = safeHref(rawHref);
    if (!check.ok) {
      errors.push({
        code: 'UNSAFE_URL',
        message: `${docId}: liên kết không hợp lệ (${rawHref})`,
      });
      continue;
    }
    if (check.href.startsWith('/')) {
      const cleanPath = check.href.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
      if (!validInternalPaths.has(cleanPath)) {
        errors.push({
          code: 'BROKEN_INTERNAL_LINK',
          message: `${docId}: liên kết nội bộ gãy "${check.href}" (không tồn tại trang đích)`,
        });
      }
    }
  }
  return errors;
}

export function parseSlugsLock(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.includes('\t')) {
      const [kind, key, locale, slug] = trimmed.split('\t');
      if (kind && key && locale && slug) {
        map.set(`${kind}/${key}.${locale}`, slug.trim());
      }
    } else {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const k = trimmed
          .slice(0, colonIdx)
          .trim()
          .replace(/^["']|["']$/g, '');
        const v = trimmed
          .slice(colonIdx + 1)
          .trim()
          .replace(/^["']|["']$/g, '');
        if (k && v) map.set(k, v);
      }
    }
  }
  return map;
}

export function buildBaseInternalPaths(): Set<string> {
  const set = new Set<string>();
  for (const r of Object.values(ROUTES)) {
    if (!r.vi.includes(':')) set.add(r.vi);
    if (!r.en.includes(':')) set.add(r.en);
  }
  return set;
}
