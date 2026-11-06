import { describe, expect, it } from 'vitest';
import { stripExifFromJpegBuffer } from '../../../scripts/content/build-site';

describe('stripExifFromJpegBuffer (IMG-13)', () => {
  const seg = (marker: number, text: string) => {
    const body = Buffer.from(text, 'latin1');
    return Buffer.concat([Buffer.from([0xff, marker, 0, body.length + 2]), body]);
  };

  it('bỏ APP1..APP15 (Exif, XMP, IPTC/8BIM), giữ APP0 và segment ảnh', () => {
    const buf = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      seg(0xe0, 'JFIF\0'),
      seg(0xe1, 'Exif\0\0Secret'),
      seg(0xed, 'Photoshop 3.0\0 8BIM IptcSecretCaption'),
      seg(0xef, 'AppFifteen'),
      seg(0xdb, 'QTABLE'),
      Buffer.from([0xff, 0xda, 0x00, 0x02, 1, 2, 3, 0xff, 0xd9]),
    ]);
    const out = stripExifFromJpegBuffer(buf).toString('latin1');
    expect(out).not.toContain('Photoshop 3.0');
    expect(out).not.toContain('8BIM');
    expect(out).not.toContain('IptcSecretCaption');
    expect(out).not.toContain('Exif');
    expect(out).not.toContain('AppFifteen');
    expect(out).toContain('JFIF');
    expect(out).toContain('QTABLE');
  });

  it('không phải JPEG thì trả nguyên', () => {
    const buf = Buffer.from('not a jpeg');
    expect(stripExifFromJpegBuffer(buf)).toBe(buf);
  });
});
