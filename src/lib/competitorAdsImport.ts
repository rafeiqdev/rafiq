import type { CompetitorAdRow } from './api';

/**
 * Maps the raw "الإعلانات" sheet — array-of-arrays including the header row —
 * to CompetitorAdRow[]. Column order is fixed and confirmed from the real
 * source file; matched by INDEX, not by Arabic header text (fragile against
 * formatting differences between exports). Column 0 (اسم الخدمة, free text)
 * is deliberately ignored — the caller already knows which catalog service
 * this import is for, from the admin's own picker selection.
 */

const COL = {
  SEARCH_LANGUAGE: 1,
  SEARCH_KEYWORD: 2,
  AD_LIBRARY_ID: 3,
  ADVERTISER_NAME: 4,
  STATUS: 5,
  STARTED_ON: 6,
  PLATFORMS: 7,
  CONTENT_TYPE: 8,
  AD_TEXT: 9,
  AD_URL: 10,
  AMOUNT_SPENT: 11,
} as const;

function cell(row: unknown[], index: number): string | null {
  const v = row[index];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export function mapCompetitorAdsSheet(rows: unknown[][]): { rows: CompetitorAdRow[]; skipped: number } {
  const dataRows = rows.slice(1); // row 0 is always the header
  const out: CompetitorAdRow[] = [];
  let skipped = 0;

  for (const row of dataRows) {
    if (!row || row.length === 0) {
      skipped += 1;
      continue;
    }
    const adLibraryId = cell(row, COL.AD_LIBRARY_ID);
    const advertiserName = cell(row, COL.ADVERTISER_NAME);
    if (!adLibraryId || !advertiserName) {
      skipped += 1;
      continue;
    }
    out.push({
      adLibraryId,
      advertiserName,
      status: cell(row, COL.STATUS),
      startedOn: cell(row, COL.STARTED_ON),
      platforms: cell(row, COL.PLATFORMS),
      contentType: cell(row, COL.CONTENT_TYPE),
      adText: cell(row, COL.AD_TEXT),
      adUrl: cell(row, COL.AD_URL),
      amountSpent: cell(row, COL.AMOUNT_SPENT),
      searchLanguage: cell(row, COL.SEARCH_LANGUAGE),
      searchKeyword: cell(row, COL.SEARCH_KEYWORD),
    });
  }

  return { rows: out, skipped };
}
