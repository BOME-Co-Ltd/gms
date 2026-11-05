// Dựng file nội dung nguồn (content/**) cho ca kiểm lúc build. Hình dạng theo 02-design/contracts/content-model.ts.
// Giá trị là DỮ LIỆU MẪU. Trường nào muốn thiếu thì truyền undefined/null để bỏ khỏi YAML.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Files } from './build';

// Tên pháp lý của bản build "đang chạy" (build-e2e-site.ts dựng từ content/company.yaml thật): đọc từ chính tệp đó,
// không viết cứng chuỗi trong test. Không đọc được thì ném lỗi (test đỏ có lý do), không đoán.
export const siteLegalName = (): string => {
  const file = resolve(dirname(fileURLToPath(import.meta.url)), '../../content/company.yaml');
  const m = /^legalName:[ \t]*(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([^\n#]+?))[ \t]*(?:#.*)?$/m.exec(
    readFileSync(file, 'utf8'),
  );
  const name = (m?.[1] ?? m?.[2] ?? m?.[3])?.trim();
  if (!name) throw new Error(`không đọc được legalName từ ${file}`);
  return name;
};

const q = (v: unknown) => JSON.stringify(v);
export const yamlItem = (o: Record<string, unknown>, pad = '  ') =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v], i) => `${i === 0 ? '- ' : pad}${k}: ${q(v)}`)
    .join('\n');

export type FigureIn = {
  key: string;
  value?: string;
  unit?: { vi: string; en: string };
  label?: { vi: string; en: string };
  source?: string | null;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  public?: boolean;
};
export const figure = (o: FigureIn): Record<string, unknown> => ({
  value: '5',
  unit: { vi: 'ha', en: 'ha' },
  label: { vi: 'Diện tích nhà máy', en: 'Plant area' },
  source: 'Báo cáo mẫu',
  confirmedBy: 'Người xác nhận mẫu',
  confirmedAt: '2026-10-01',
  public: true,
  ...o,
});
export const figuresFile = (items: Record<string, unknown>[]): Files => ({
  'figures.yaml': items.map((i) => yamlItem(i)).join('\n') + '\n',
});

// content/company.yaml (NAP một nguồn). over: trường nào = null/undefined thì bỏ khỏi YAML.
export const companyFile = (over: Record<string, unknown> = {}): Files => {
  const base: Record<string, unknown> = {
    legalName: 'Công ty Mẫu GMS',
    address: { vi: 'Số 1 Đường Mẫu, Hưng Yên', en: '1 Sample Street, Hung Yen' },
    phone: '+84900000000',
    zalo: 'https://zalo.me/0900000000',
    privacyRequestEmail: 'dulieu@vi-du.test',
    ...over,
  };
  return {
    'company.yaml':
      Object.entries(base)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}: ${q(v)}`)
        .join('\n') + '\n',
  };
};

export const pageFile = (
  key: string,
  locale: 'vi' | 'en',
  body: string,
  over: Record<string, unknown> = {},
): Files => ({
  [`pages/${key}.${locale}.md`]: `---\n${Object.entries({
    slug: key,
    key,
    title: `Trang ${key}`,
    published: true,
    ...over,
  })
    .map(([k, v]) => `${k}: ${q(v)}`)
    .join('\n')}\n---\n${body}\n`,
});

export const imageMeta = (name: string, over: Record<string, unknown> = {}): Files => ({
  [`images/${name}.yaml`]:
    Object.entries({
      alt: { vi: 'Ảnh mẫu', en: 'Sample' },
      kind: 'anh-that',
      hasPeople: false,
      source: 'Nguồn mẫu',
      ...over,
    })
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}: ${q(v)}`)
      .join('\n') + '\n',
});

// JPEG tối thiểu mang khối EXIF (APP1) có GPS + tên máy: dùng để chứng minh build xoá EXIF.
export const jpegWithExif = (): Buffer => {
  const exif = Buffer.from('Exif\0\0MM\0*GPSLatitude=21.0000 Make=FlycamX', 'latin1');
  const len = exif.length + 2;
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255]),
    exif,
    Buffer.from([0xff, 0xdb, 0, 3, 0, 0xff, 0xd9]),
  ]);
};
export const bytesOfSize = (n: number, head: number[]) =>
  Buffer.concat([Buffer.from(head), Buffer.alloc(Math.max(0, n - head.length), 1)]);
export const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0];
export const GIF_HEAD = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
