// Luật quét "tên không được nêu" ở tầng hàm (contracts/content-model.ts) — test-plan.md 0k E (Q14-1, Q14-2) + IMG-12.
// Kỳ vọng lấy từ contracts/README.md "Lượt 16" (bảng 21 ca) và threat-model.md:110 (4 ca admin 07/11), không từ mã.
// Ký tự vô hình viết bằng String.fromCharCode; không để ký tự vô hình trong tệp này.
import { describe, expect, it } from 'vitest';
import {
  ALL_IMAGE_SLOTS,
  decodeForNameScan,
  findForbiddenNames,
  HOME_IMAGE_SLOT_KIND,
  HOME_IMAGE_SLOTS,
  NAME_SCAN_DECODE_PASSES_MAX,
  TECHNOLOGY_IMAGE_SLOTS,
} from '../../contracts/content-model.ts';

const NAME = 'Xanh Asian';
const F = (x: string) => findForbiddenNames(x, [NAME]);
const D = (x: string) => decodeForNameScan(x);
const ch = (cp: number) => String.fromCharCode(cp);

describe('Q14-1 findForbiddenNames / decodeForNameScan — 25 ca của appsec (+ U-26 của qa)', () => {
  it.each([
    ['U-01', 'xanh%2520asian'],
    ['U-02', 'xanh%26nbsp%3Basian'],
    ['U-03', 'xanh%5Cu0020asian'],
    ['U-04', 'Xanh&amp;nbsp;Asian'],
    ['U-05', 'Xanh&amp;#x20;Asian'],
    ['U-06', 'xanh%252520asian'],
    ['U-09', `Xanh${ch(0x200b)}Asian`],
    ['U-10', `Xa${ch(0xad)}nh Asian`],
    ['U-11', 'Xa&shy;nh Asian'],
    ['U-12', 'Xanh&#x200B;Asian'],
    ['U-13', 'xanh%E2%80%8Basian'],
    ['U-14', `Xanh${ch(0x2060)} Asian`],
    ['U-17', '/?q=Xanh+Asian'],
    ['U-18', 'xanh%2Basian'],
    ['U-22', 'Xanh&nbsp;Asian'],
    ['U-23', 'Công ty Xanh  Asian JSC'],
    ['U-24', 'Xanh-Asian'],
    ['U-25', 'Xanhasian'],
  ])('%s bắt được: %s', (_id, input) => {
    expect(F(input)).toEqual([NAME]);
  });

  it('U-07 "xanh%25252520asian" (4 lớp) lọt — giới hạn trần 3 lượt (giới hạn — đổi kết quả thì báo appsec)', () => {
    expect(F('xanh%25252520asian')).toEqual([]);
  });
  it('U-08 "Xanh&amp;amp;amp;nbsp;Asian" (4 lớp) lọt — giới hạn trần 3 lượt (giới hạn — đổi kết quả thì báo appsec)', () => {
    expect(F('Xanh&amp;amp;amp;nbsp;Asian')).toEqual([]);
  });
  it('U-15 "Xanh, Asian" không bắt (cố ý: dấu câu khác không đỏ oan)', () => {
    expect(F('Xanh, Asian')).toEqual([]);
  });
  it('U-16 "C++ +84" không bắt', () => {
    expect(F('C++ +84')).toEqual([]);
  });
  it('U-19 decode "%20%FF%20" => " %FF " (byte hỏng giữ nguyên, phần hợp lệ vẫn giải)', () => {
    expect(D('%20%FF%20')).toBe(' %FF ');
  });
  it('U-20 decode "%C3%C3%A1" => "%C3á"', () => {
    expect(D('%C3%C3%A1')).toBe('%C3á');
  });
  it('U-21 decode "&constructor;" giữ nguyên (không dính khoá Object.prototype)', () => {
    expect(D('&constructor;')).toBe('&constructor;');
  });
  it('U-26 NAME_SCAN_DECODE_PASSES_MAX = 3 (README Lượt 16)', () => {
    expect(NAME_SCAN_DECODE_PASSES_MAX).toBe(3);
  });
});

describe('Q14-2 ca giới hạn — kết quả đổi thì báo appsec (giới hạn — đổi kết quả thì báo appsec)', () => {
  // Không sửa test cho xanh khi một ca đổi: báo appsec chấm lại M40-d/e/f (threat-model.md:111, :119).
  it.each([
    ['L-01 (M40-b trần, = U-07)', 'xanh%25252520asian'],
    ['L-02 (M40-b trần, = U-08)', 'Xanh&amp;amp;amp;nbsp;Asian'],
    ['L-03 (M40-d thực thể thiếu ";")', 'Xanh&nbspAsian'],
    ['L-04 (M40-d)', 'Xanh&#32Asian'],
    ['L-05 (M40-e, U+2800)', `Xanh${ch(0x2800)}Asian`],
    ['L-06 (M40-e, U+3164)', `Xanh${ch(0x3164)}Asian`],
    ['L-07 (M40-f)', `Xanh&nb${ch(0x200b)}sp;Asian`],
  ])('giới hạn — đổi kết quả thì báo appsec: %s => []', (_id, input) => {
    expect(F(input)).toEqual([]);
  });
});

describe('IMG-12 hằng ô ảnh cố định (content-model.ts, lượt 13–14)', () => {
  it('ô trang chủ, ô Công nghệ và loại bắt buộc', () => {
    expect(HOME_IMAGE_SLOTS).toEqual({ before: 'gms-before', after: 'gms-after' });
    expect(HOME_IMAGE_SLOT_KIND).toBe('anh-that');
    expect(TECHNOLOGY_IMAGE_SLOTS).toEqual({ sortingLine: 'gms-sorting-line' });
    expect([...ALL_IMAGE_SLOTS].sort()).toEqual(['gms-after', 'gms-before', 'gms-sorting-line']);
  });
});
