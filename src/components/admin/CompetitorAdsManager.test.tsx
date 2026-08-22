import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) =>
      vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k,
    i18n: { language: 'ar' },
  }),
}));

const listImportsMock = vi.fn();
const latestImportMock = vi.fn();
const listAdsMock = vi.fn();
const importRowsMock = vi.fn();
vi.mock('../../lib/api', () => ({
  adminCompetitorAds: {
    listImports: (...a: unknown[]) => listImportsMock(...a),
    latestImport: (...a: unknown[]) => latestImportMock(...a),
    listAds: (...a: unknown[]) => listAdsMock(...a),
    importRows: (...a: unknown[]) => importRowsMock(...a),
  },
}));

const readFileMock = vi.fn();
vi.mock('../../lib/competitorAdsFile', () => ({
  readCompetitorAdsFile: (...a: unknown[]) => readFileMock(...a),
}));

import { CompetitorAdsManager } from './CompetitorAdsManager';

const IMPORT = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'i1', serviceId: 'res-tourist', fileName: 'ads.xlsx', rowCount: 2,
  importedBy: null, importedAt: '2026-08-20T00:00:00Z', ...over,
});
const AD = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'ad-1', importId: 'i1', serviceId: 'res-tourist', adLibraryId: 'lib-1',
  advertiserName: 'شركة أ', status: 'Active', startedOn: null, platforms: null,
  contentType: null, adText: null, adUrl: null, amountSpent: null,
  searchLanguage: null, searchKeyword: null, seenInPreviousImport: false,
  createdAt: '2026-08-20T00:00:00Z', ...over,
});

beforeEach(() => {
  listImportsMock.mockReset().mockResolvedValue([]);
  latestImportMock.mockReset().mockResolvedValue(null);
  listAdsMock.mockReset().mockResolvedValue([]);
  importRowsMock.mockReset();
  readFileMock.mockReset();
});

describe('CompetitorAdsManager', () => {
  it('shows an empty state with no service selected', () => {
    render(<CompetitorAdsManager />);

    expect(screen.getByText('competitorAds.manager.pickService')).toBeInTheDocument();
  });

  it('pre-selects the service passed via initialServiceId', async () => {
    latestImportMock.mockResolvedValue(IMPORT());
    listAdsMock.mockResolvedValue([AD()]);

    render(<CompetitorAdsManager initialServiceId="res-tourist" />);

    await waitFor(() => expect(latestImportMock).toHaveBeenCalledWith('res-tourist'));
  });

  it('shows an empty-data state (with an import shortcut) when the service has no imports yet', async () => {
    latestImportMock.mockResolvedValue(null);

    render(<CompetitorAdsManager initialServiceId="res-tourist" />);

    expect(await screen.findByText('competitorAds.manager.noDataYet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'competitorAds.manager.importNew' })).toBeInTheDocument();
  });

  it('groups ads from the latest import by advertiser', async () => {
    latestImportMock.mockResolvedValue(IMPORT());
    listAdsMock.mockResolvedValue([
      AD({ id: 'a1', advertiserName: 'شركة أ' }),
      AD({ id: 'a2', advertiserName: 'شركة أ' }),
      AD({ id: 'a3', advertiserName: 'شركة ب' }),
    ]);

    render(<CompetitorAdsManager initialServiceId="res-tourist" />);

    expect(await screen.findByText('شركة أ')).toBeInTheDocument();
    expect(screen.getByText('شركة ب')).toBeInTheDocument();
    // one card per advertiser, not one per ad
    expect(screen.getAllByRole('button', { name: /شركة/ })).toHaveLength(2);
  });

  it('only shows "previous versions" once more than one import exists', async () => {
    latestImportMock.mockResolvedValue(IMPORT());
    listAdsMock.mockResolvedValue([AD()]);
    listImportsMock.mockResolvedValue([IMPORT()]); // just one

    render(<CompetitorAdsManager initialServiceId="res-tourist" />);
    await screen.findByText('شركة أ');

    expect(screen.queryByRole('button', { name: 'competitorAds.manager.previousVersions' })).not.toBeInTheDocument();
  });

  it('shows "previous versions" when more than one import exists, and switches the view on selection', async () => {
    const older = IMPORT({ id: 'i0', importedAt: '2026-08-01T00:00:00Z' });
    latestImportMock.mockResolvedValue(IMPORT());
    listImportsMock.mockResolvedValue([IMPORT(), older]);
    listAdsMock.mockImplementation((importId: string) =>
      Promise.resolve(importId === 'i0' ? [AD({ id: 'old-ad', advertiserName: 'شركة قديمة' })] : [AD({ advertiserName: 'شركة أ' })]),
    );

    render(<CompetitorAdsManager initialServiceId="res-tourist" />);
    await screen.findByText('شركة أ');

    fireEvent.click(screen.getByRole('button', { name: 'competitorAds.manager.previousVersions' }));
    fireEvent.click(await screen.findByText(/2026-08-01/));

    expect(await screen.findByText('شركة قديمة')).toBeInTheDocument();
    expect(listAdsMock).toHaveBeenCalledWith('i0');
  });

  it('imports a parsed file and reloads the latest-import view', async () => {
    latestImportMock.mockResolvedValueOnce(null).mockResolvedValueOnce(IMPORT());
    readFileMock.mockResolvedValue({ rows: [{ adLibraryId: 'lib-1', advertiserName: 'شركة أ' }], skipped: 0 });
    importRowsMock.mockResolvedValue(IMPORT());
    listAdsMock.mockResolvedValue([AD()]);

    render(<CompetitorAdsManager initialServiceId="res-tourist" />);
    await screen.findByText('competitorAds.manager.noDataYet');

    const file = new File(['x'], 'ads.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const input = screen.getByLabelText('competitorAds.manager.chooseFile', { selector: 'input' });
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(await screen.findByRole('button', { name: 'competitorAds.manager.confirmImport' }));

    await waitFor(() => expect(importRowsMock).toHaveBeenCalledWith('res-tourist', 'ads.xlsx', [{ adLibraryId: 'lib-1', advertiserName: 'شركة أ' }]));
    expect(await screen.findByText('شركة أ')).toBeInTheDocument();
  });
});
