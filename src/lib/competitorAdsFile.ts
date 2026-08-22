import * as XLSX from 'xlsx';
import { mapCompetitorAdsSheet } from './competitorAdsImport';
import type { CompetitorAdRow } from './api';

/**
 * Reads the first sheet of an uploaded .xlsx File and maps it to
 * CompetitorAdRow[]. Thin wrapper around the SheetJS `xlsx` library and the
 * File API — a file-I/O boundary, not unit-tested, same convention as
 * OfferImagesField's upload handler in ServiceRequestsManager.tsx. All the
 * actual mapping logic lives in the tested mapCompetitorAdsSheet().
 */
export async function readCompetitorAdsFile(file: File): Promise<{ rows: CompetitorAdRow[]; skipped: number }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { rows: [], skipped: 0 };
  const sheet = workbook.Sheets[firstSheetName];
  const asArrays = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  return mapCompetitorAdsSheet(asArrays);
}
