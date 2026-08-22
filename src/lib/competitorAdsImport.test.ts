import { describe, expect, it } from 'vitest';
import { mapCompetitorAdsSheet } from './competitorAdsImport';

/**
 * Maps the raw "الإعلانات" sheet (array-of-arrays, header row included) to
 * CompetitorAdRow[]. Columns are matched by INDEX, not by Arabic header text
 * — header-string matching is fragile against formatting differences between
 * exports, index position is not.
 */

const HEADER = [
  'اسم الخدمة', 'اللغة المستخدمة بالبحث', 'الكلمة المفتاحية المستخدمة', 'رقم الإعلان Library ID',
  'اسم الصفحة المعلنة (Advertiser / Page name)', 'حالة الإعلان (Active أو Inactive)',
  'تاريخ بداية عرض الإعلان (Started running on)', 'المنصات', 'نوع المحتوى الإبداعي',
  'النص الكامل للإعلان', 'رابط الإعلان المباشر', 'المبلغ المصروف',
];

const REAL_ROW: (string | number)[] = [
  'إقامة سياحية', 'العربية', 'إقامة سياحية في تركيا', '202993668427755',
  'عبدالله الحمصي', 'Inactive', '27 Jul 2021 - 27 Jul 2021', 'غير متاح', 'نص فقط',
  "This content was removed because it didn't follow our\n.",
  'https://www.facebook.com/ads/library/?id=202993668427755',
  'غير متاح — Meta ما بتكشفه للإعلانات التجارية العادية',
];

describe('mapCompetitorAdsSheet', () => {
  it('skips the header row', () => {
    const { rows } = mapCompetitorAdsSheet([HEADER, REAL_ROW]);

    expect(rows).toHaveLength(1);
  });

  it('maps every column to the right field, by position', () => {
    const { rows } = mapCompetitorAdsSheet([HEADER, REAL_ROW]);

    expect(rows[0]).toEqual({
      adLibraryId: '202993668427755',
      advertiserName: 'عبدالله الحمصي',
      status: 'Inactive',
      startedOn: '27 Jul 2021 - 27 Jul 2021',
      platforms: 'غير متاح',
      contentType: 'نص فقط',
      adText: "This content was removed because it didn't follow our\n.",
      adUrl: 'https://www.facebook.com/ads/library/?id=202993668427755',
      amountSpent: 'غير متاح — Meta ما بتكشفه للإعلانات التجارية العادية',
      searchLanguage: 'العربية',
      searchKeyword: 'إقامة سياحية في تركيا',
    });
  });

  it('skips a row with no Library ID rather than importing a junk row', () => {
    const blank = [...REAL_ROW]; blank[3] = '';
    const { rows, skipped } = mapCompetitorAdsSheet([HEADER, blank]);

    expect(rows).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('skips an entirely empty trailing row', () => {
    const { rows, skipped } = mapCompetitorAdsSheet([HEADER, REAL_ROW, []]);

    expect(rows).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it('coerces a numeric-looking Library ID to a string', () => {
    // SheetJS returns numeric-looking cells as JS numbers, not strings.
    const numericIdRow = [...REAL_ROW]; numericIdRow[3] = 202993668427755;
    const { rows } = mapCompetitorAdsSheet([HEADER, numericIdRow]);

    expect(rows[0].adLibraryId).toBe('202993668427755');
    expect(typeof rows[0].adLibraryId).toBe('string');
  });

  it('returns an empty result for a sheet with only a header row', () => {
    const { rows, skipped } = mapCompetitorAdsSheet([HEADER]);

    expect(rows).toEqual([]);
    expect(skipped).toBe(0);
  });

  it('returns an empty result for a completely empty sheet', () => {
    const { rows, skipped } = mapCompetitorAdsSheet([]);

    expect(rows).toEqual([]);
    expect(skipped).toBe(0);
  });
});
