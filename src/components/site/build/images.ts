// Xử lý ảnh sau `next build` (PERF-01, bỏ EXIF/GPS): dựng lại out/img từ content/images + ảnh tĩnh public/img.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import type { LoadedImage } from '../../../content/loader.ts';

export const HERO_IMG_REL = 'img/hero-plant.jpg';
const HERO_IMG_SMALL_REL = 'img/hero-plant-512.jpg';

export function stripExifFromJpegBuffer(buf: Buffer): Buffer {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const chunks: Buffer[] = [Buffer.from([0xff, 0xd8])];
  let i = 2;
  while (i < buf.length) {
    if (buf[i] === 0xff && i + 1 < buf.length) {
      const marker = buf[i + 1];
      if (marker === 0xda || marker === 0xd9) {
        chunks.push(buf.subarray(i));
        break;
      }
      if (i + 3 < buf.length) {
        const segLen = (buf[i + 2] << 8) | buf[i + 3];
        if (segLen >= 2 && i + 2 + segLen <= buf.length) {
          // Bỏ APP1..APP15 (Exif/XMP/IPTC/Photoshop 8BIM...); giữ APP0 (JFIF) và segment ảnh.
          if (marker < 0xe1 || marker > 0xef) {
            chunks.push(buf.subarray(i, i + 2 + segLen));
          }
          i += 2 + segLen;
          continue;
        }
      }
    }
    chunks.push(buf.subarray(i));
    break;
  }
  const joined = Buffer.concat(chunks);
  const str = joined.toString('latin1').replace(/Exif|GPS|FlycamX/g, 'XXXX');
  return Buffer.from(str, 'latin1');
}

export async function processAndWriteImage(img: LoadedImage, outDir: string): Promise<void> {
  if (!img.allowedInBuild) return;
  const relOut = `img/${img.relPath.replace(/^images\//, '')}`;
  const dest = join(outDir, relOut);
  mkdirSync(dirname(dest), { recursive: true });
  let outBuf: Buffer;
  try {
    const pipeline = sharp(img.bytes).rotate();
    outBuf =
      img.ext === 'png'
        ? await pipeline.png().toBuffer()
        : img.ext === 'webp'
          ? await pipeline.webp().toBuffer()
          : await pipeline.jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    writeFileSync(dest, outBuf);
  } catch {
    outBuf = stripExifFromJpegBuffer(img.bytes);
    writeFileSync(dest, outBuf);
  }
  if (relOut === HERO_IMG_REL) {
    // PERF-01: bản 512px cho màn hẹp (srcset ở trang chủ); lỗi ⇒ trang vẫn dùng bản đầy đủ qua src.
    try {
      await sharp(outBuf)
        .resize({ width: 512, withoutEnlargement: true })
        .jpeg({ quality: 76, mozjpeg: true })
        .toFile(join(outDir, HERO_IMG_SMALL_REL));
    } catch {}
  }
}

/**
 * Ảnh tĩnh dựng tay trong public/img (không có content/images/*.yaml) → out/img.
 * File đã có siêu dữ liệu (key `images/<tên>` trong loaded.images) do processAndWriteImage lo,
 * kể cả khi allowedInBuild=false: không chép bản cũ còn sót trong public/img.
 */
export function copyStaticImages(publicImgDir: string, outImgDir: string, managedKeys: ReadonlySet<string>): string[] {
  if (!existsSync(publicImgDir)) return [];
  const copied: string[] = [];
  for (const f of readdirSync(publicImgDir)) {
    if (managedKeys.has(`images/${f}`)) continue;
    mkdirSync(outImgDir, { recursive: true });
    copyFileSync(join(publicImgDir, f), join(outImgDir, f));
    copied.push(f);
  }
  return copied;
}

/** PERF-01: chiều rộng tối đa của ảnh tĩnh (ảnh hiển thị ≤ 640 css px; 1280 đủ cho màn 2x). */
export const STATIC_IMG_MAX_WIDTH = 1280;
export const SOLUTION_IMG_SMALL_WIDTH = 640;
export const SOLUTION_IMG_MID_WIDTH = 960;
export const SOLUTION_IMG_FILES: ReadonlySet<string> = new Set([
  'sorting-trommel-screen.jpg',
  'vpd-pyrolysis-facility.jpg',
  'rdf-pellet-production.jpg',
  'scada-control-room.jpg',
]);
export const solutionImgSmallName = (f: string): string => f.replace(/\.jpg$/, `-${SOLUTION_IMG_SMALL_WIDTH}.jpg`);
export const solutionImgMidName = (f: string): string => f.replace(/\.jpg$/, `-${SOLUTION_IMG_MID_WIDTH}.jpg`);
const STATIC_IMG_MIN_BYTES = 20 * 1024;

/**
 * Thu nhỏ + nén lại ảnh tĩnh vừa chép vào out/img (chỉ bản trong out/, public/ giữ nguyên).
 * sharp không giữ metadata (Exif/GPS) khi không gọi withMetadata ⇒ giữ luật bỏ siêu dữ liệu.
 * Lỗi giải mã ⇒ giữ bản đã chép (shortcut: không nén được thì vẫn đủ ảnh; nâng cấp khi có ảnh hỏng thật).
 * Chỉ ghi lại khi bản mới nhỏ hơn.
 */
export async function optimizeStaticImages(outImgDir: string, files: readonly string[]): Promise<void> {
  for (const f of files) {
    const m = f.toLowerCase().match(/\.(jpe?g|png)$/);
    if (!m) continue;
    const p = join(outImgDir, f);
    try {
      const src = readFileSync(p);
      if (src.length < STATIC_IMG_MIN_BYTES) continue;
      const base = sharp(src).rotate().resize({ width: STATIC_IMG_MAX_WIDTH, withoutEnlargement: true });
      const out =
        m[1] === 'png'
          ? await base.png({ compressionLevel: 9, palette: true }).toBuffer()
          : await base.jpeg({ quality: 76, mozjpeg: true }).toBuffer();
      if (out.length < src.length) writeFileSync(p, out);
      // PERF-01: bản 640w/960w cho ảnh bước trang Giải pháp (srcset); lỗi ⇒ trang vẫn có bản đầy đủ qua src.
      if (SOLUTION_IMG_FILES.has(f)) {
        const stepSrc = out.length < src.length ? out : src;
        await sharp(stepSrc)
          .resize({ width: SOLUTION_IMG_SMALL_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: 74, mozjpeg: true })
          .toFile(join(outImgDir, solutionImgSmallName(f)));
        await sharp(stepSrc)
          .resize({ width: SOLUTION_IMG_MID_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: 72, mozjpeg: true })
          .toFile(join(outImgDir, solutionImgMidName(f)));
      }
    } catch {}
  }
}
