import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en' },
  }),
}));

const adminListMock = vi.fn();
vi.mock('../lib/api', () => ({
  serviceRequests: { adminList: () => adminListMock() },
  adminServiceOffers: {},
  logPiiReveal: vi.fn(),
}));

import { ServiceRequestsManager } from './ServiceRequestsManager';

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'r1', name: 'Ahmet', phone: '+90 555 123 45 67', message: undefined,
  serviceId: 'res-tourist', serviceTitle: 'İkamet', category: 'residency', serviceType: 'direct',
  status: 'new', createdAt: new Date().toISOString(), ownerName: null, ownerEmail: null,
  ...over,
});

beforeEach(() => {
  adminListMock.mockReset();
});

describe('ServiceRequestsManager — competitor link', () => {
  it('links to the competitors tab for the row\'s service', async () => {
    adminListMock.mockResolvedValue([row({ serviceId: 'res-tourist' })]);

    render(<ServiceRequestsManager />);

    const link = await screen.findByRole('link', { name: 'admin.serviceRequests.competitors' });
    expect(link).toHaveAttribute('href', '/admin?tab=competitors&service=res-tourist');
  });

  it('omits the link when the row has no serviceId', async () => {
    adminListMock.mockResolvedValue([row({ serviceId: null })]);

    render(<ServiceRequestsManager />);

    await screen.findByText('İkamet');
    expect(screen.queryByRole('link', { name: 'admin.serviceRequests.competitors' })).toBeNull();
  });
});
