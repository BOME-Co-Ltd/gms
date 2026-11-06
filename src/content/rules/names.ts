// Tên không được nêu (contracts/content-model.ts ForbiddenNames/findForbiddenNames; build.ts §8 luật (6)).
// Không chép lại logic so khớp: mọi so sánh đi qua `findForbiddenNames` của contract.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { CONTENT_RULE_MESSAGES, OUTPUT_SCAN_BINARY_EXTENSIONS } from '../../../contracts/build.ts';
import { DENYLIST_PATH, ForbiddenNames, findForbiddenNames } from '../../../contracts/content-model.ts';
import type { ContentError } from './index.ts';

type Loc = 'vi' | 'en';
const BINARY_EXT: readonly string[] = OUTPUT_SCAN_BINARY_EXTENSIONS;
const MAX_DEPTH = 12;

/** Đọc content/denylist.yaml. Thiếu tệp / sai YAML / sai schema / `names` rỗng ⇒ DENYLIST_MISSING (mọi SITE_ENV). */
export function loadDenylist(contentDir: string): { names: string[] } | { error: ContentError } {
  const error: ContentError = { code: 'DENYLIST_MISSING', message: CONTENT_RULE_MESSAGES.DENYLIST_MISSING() };
  const path = join(contentDir, DENYLIST_PATH);
  if (!existsSync(path)) return { error };
  let raw: unknown;
  try {
    raw = parseYaml(readFileSync(path, 'utf8'));
  } catch {
    return { error };
  }
  const parsed = ForbiddenNames.safeParse(raw);
  return parsed.success ? { names: parsed.data.names } : { error };
}

function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (rel: string, depth: number): void => {
    if (depth > MAX_DEPTH) return;
    for (const entry of readdirSync(rel === '' ? root : join(root, rel)).sort()) {
      const childRel = rel === '' ? entry : `${rel}/${entry}`;
      const st = statSync(join(root, childRel));
      if (st.isDirectory()) walk(childRel, depth + 1);
      else if (st.isFile()) out.push(childRel);
    }
  };
  if (existsSync(root)) walk('', 0);
  return out;
}

const extOf = (rel: string): string => {
  const base = basename(rel);
  const i = base.lastIndexOf('.');
  return i <= 0 ? '' : base.slice(i + 1).toLowerCase();
};

const localeOfFile = (rel: string): Loc | undefined => {
  const m = basename(rel).match(/\.(vi|en)\.[^.]+$/);
  return m ? (m[1] as Loc) : undefined;
};

function parseFront(raw: string): { data: unknown; body: string } | null {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  return { data: parseYaml(m[1] ?? ''), body: m[2] ?? '' };
}

/**
 * Lượt (a) content-check: mọi tệp dưới `contentDir` trừ DENYLIST_PATH và approvals/** — đường dẫn của MỌI tệp, và nội dung
 * tệp văn bản theo từng giá trị chuỗi (md: frontmatter + thân bài; yaml/yml; tệp văn bản khác: nguyên văn).
 */
export function scanContentForForbiddenNames(contentDir: string, names: readonly string[]): ContentError[] {
  const errors: ContentError[] = [];
  const seen = new Set<string>();
  const report = (file: string, locale: Loc | undefined, field: string | undefined, name: string): void => {
    const key = JSON.stringify([file, locale ?? '', field ?? '', name]);
    if (seen.has(key)) return;
    seen.add(key);
    errors.push({
      code: 'FORBIDDEN_NAME_IN_CONTENT',
      message: CONTENT_RULE_MESSAGES.FORBIDDEN_NAME_IN_CONTENT({
        file,
        ...(locale ? { locale } : {}),
        ...(field ? { field } : {}),
        name,
      }),
    });
  };

  const scanValue = (file: string, fileLoc: Loc | undefined, value: unknown, path: string[]): void => {
    if (typeof value === 'string') {
      const last = path[path.length - 1];
      const keyLoc = last === 'vi' || last === 'en' ? last : undefined;
      for (const n of findForbiddenNames(value, names)) {
        report(file, fileLoc ?? keyLoc, path.length > 0 ? path.join('.').replace(/\.\[/g, '[') : undefined, n);
      }
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => {
        scanValue(file, fileLoc, v, [...path, `[${i}]`]);
      });
    } else if (value !== null && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) scanValue(file, fileLoc, v, [...path, k]);
    }
  };

  for (const rel of listFiles(contentDir)) {
    if (rel === DENYLIST_PATH || rel.startsWith('approvals/')) continue;
    const loc = localeOfFile(rel);
    for (const n of findForbiddenNames(rel, names)) report(rel, loc, 'tên tệp', n);
    const ext = extOf(rel);
    if (BINARY_EXT.includes(ext)) continue;
    const text = readFileSync(join(contentDir, rel), 'utf8');
    try {
      if (ext === 'md') {
        const front = parseFront(text);
        if (front) {
          scanValue(rel, loc, front.data, []);
          for (const n of findForbiddenNames(front.body, names)) report(rel, loc, 'thân bài', n);
        } else {
          for (const n of findForbiddenNames(text, names)) report(rel, loc, 'thân bài', n);
        }
        continue;
      }
      if (ext === 'yaml' || ext === 'yml') {
        scanValue(rel, loc, parseYaml(text), []);
        continue;
      }
    } catch {
      // YAML hỏng: quét nguyên văn bên dưới để không bỏ lọt (lỗi cú pháp do luật khác báo).
    }
    for (const n of findForbiddenNames(text, names)) report(rel, loc, undefined, n);
  }
  return errors;
}

/**
 * Lượt output-check (sau next build): MỌI tệp dưới `outDir`. Đuôi nhị phân ⇒ chỉ so đường dẫn; còn lại so cả nội dung
 * (UTF-8, byte hỏng thành U+FFFD, không bỏ tệp). Tệp tên DENYLIST_PATH ở bất kỳ đâu ⇒ DENYLIST_IN_OUTPUT.
 * Chưa nối vào script `output-check` (package.json/build chain ngoài lãnh địa backend).
 */
export function scanOutputForForbiddenNames(outDir: string, names: readonly string[]): ContentError[] {
  const errors: ContentError[] = [];
  for (const rel of listFiles(outDir)) {
    if (basename(rel) === DENYLIST_PATH) {
      errors.push({
        code: 'DENYLIST_IN_OUTPUT',
        message: CONTENT_RULE_MESSAGES.DENYLIST_IN_OUTPUT({ file: rel }),
      });
    }
    for (const name of findForbiddenNames(rel, names)) {
      errors.push({
        code: 'FORBIDDEN_NAME_IN_OUTPUT',
        message: CONTENT_RULE_MESSAGES.FORBIDDEN_NAME_IN_OUTPUT({ file: rel, name, inPath: true }),
      });
    }
    if (BINARY_EXT.includes(extOf(rel))) continue;
    const text = readFileSync(join(outDir, rel)).toString('utf8');
    for (const name of findForbiddenNames(text, names)) {
      errors.push({
        code: 'FORBIDDEN_NAME_IN_OUTPUT',
        message: CONTENT_RULE_MESSAGES.FORBIDDEN_NAME_IN_OUTPUT({ file: rel, name, inPath: false }),
      });
    }
  }
  return errors;
}
