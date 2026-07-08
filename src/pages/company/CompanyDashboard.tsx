import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { companies } from '../../lib/api';
import type { Company, CompanyLead } from '../../lib/types';
import { isCompanyActive } from '../../lib/types';
import { RequireCompany } from '../../components/Gates';
import { CompanyLeadCard } from '../../components/company/CompanyLeadCard';
import { AppIcon } from '../../components/AppIcon';

function StatusPill({ kind, label }: { kind: 'ok' | 'warn' | 'bad'; label: string }) {
  const cls = kind === 'ok' ? 'bg-green-100 text-green-800' : kind === 'warn' ? 'bg-gold-soft text-gold-dark' : 'bg-brand-red/10 text-brand-red';
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${cls}`}>{label}</span>;
}

function DashboardInner() {
  const { t, i18n } = useTranslation();
  const [company, setCompany] = useState<Company | null | undefined>(undefined);
  const [leads, setLeads] = useState<CompanyLead[]>([]);

  const loadLeads = () => companies.leads().then(setLeads).catch(() => setLeads([]));

  useEffect(() => {
    companies.mine().then((c) => {
      setCompany(c);
      if (c && isCompanyActive(c)) loadLeads();
    }).catch(() => setCompany(null));
  }, []);

  if (company === undefined) {
    return (
      <div className="flex items-center justify-center py-32" role="status">
        <div className="w-10 h-10 rounded-full border-4 border-cream-dark border-t-navy animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="card p-8">
          <div className="icon-chip mx-auto">
            <AppIcon name="briefcase" className="w-6 h-6" />
          </div>
          <p className="mt-4 text-sm text-navy/70">{t('company.dashboard.noCompany')}</p>
          <Link to="/company/register" className="btn-primary w-full mt-6">{t('company.dashboard.registerCta')}</Link>
        </div>
      </div>
    );
  }

  const active = isCompanyActive(company);
  const statusKind = company.status === 'approved' ? 'ok' : company.status === 'suspended' ? 'bad' : 'warn';
  const subKind = company.subscriptionStatus === 'active' ? 'ok' : 'warn';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy">{company.name}</h1>
          <p className="mt-1 text-sm text-navy/60">{t('company.dashboard.title')}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/company/profile" className="btn-secondary h-9 px-3 text-xs">
            <AppIcon name="pencil" className="w-3.5 h-3.5" />
            {t('company.dashboard.editProfile')}
          </Link>
          <Link to="/company/billing" className="btn-primary h-9 px-3 text-xs">
            <AppIcon name="credit-card" className="w-3.5 h-3.5" />
            {t('company.dashboard.subLabel')}
          </Link>
        </div>
      </div>

      {/* status panel */}
      <div className="card p-5 mt-6 grid sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-navy/60">{t('company.dashboard.statusLabel')}</span>
          <StatusPill kind={statusKind} label={t('company.status.' + company.status)} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-navy/60">{t('company.dashboard.subLabel')}</span>
          <StatusPill kind={subKind} label={t('company.sub.' + company.subscriptionStatus)} />
          {company.subscriptionExpiresAt && company.subscriptionStatus === 'active' && (
            <span className="text-xs text-navy/50">{t('company.dashboard.expiresOn', { date: new Date(company.subscriptionExpiresAt).toLocaleDateString(i18n.language) })}</span>
          )}
        </div>
      </div>

      {/* gated states */}
      {company.status === 'pending' && (
        <div className="card p-6 mt-5 text-center">
          <div className="icon-chip-gold mx-auto"><AppIcon name="hourglass" className="w-6 h-6" /></div>
          <h2 className="mt-3 font-extrabold text-navy">{t('company.dashboard.pendingTitle')}</h2>
          <p className="mt-2 text-sm text-navy/60">{t('company.dashboard.pendingBody')}</p>
        </div>
      )}

      {company.status === 'suspended' && (
        <div className="card p-6 mt-5 text-center">
          <div className="icon-chip mx-auto"><AppIcon name="alert-triangle" className="w-6 h-6" /></div>
          <h2 className="mt-3 font-extrabold text-navy">{t('company.dashboard.suspendedTitle')}</h2>
          <p className="mt-2 text-sm text-navy/60">{t('company.dashboard.suspendedBody')}</p>
        </div>
      )}

      {company.status === 'approved' && !active && (
        <div className="card p-6 mt-5 text-center">
          <div className="icon-chip-gold mx-auto"><AppIcon name="credit-card" className="w-6 h-6" /></div>
          <h2 className="mt-3 font-extrabold text-navy">{t('company.dashboard.notActiveTitle')}</h2>
          <p className="mt-2 text-sm text-navy/60">{t('company.dashboard.notActiveBody')}</p>
          <Link to="/company/billing" className="btn-primary mt-5">{t('company.dashboard.subscribeCta')}</Link>
        </div>
      )}

      {/* incoming requests (only when active) */}
      {active && (
        <div className="card p-6 mt-5">
          <h2 className="font-bold text-navy">{t('company.dashboard.leadsTitle')}</h2>
          {leads.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">{t('company.dashboard.leadsEmpty')}</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {leads.map((l) => (
                <CompanyLeadCard key={l.id} lead={l} companyId={company.id} onResponded={loadLeads} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function CompanyDashboard() {
  return (
    <RequireCompany>
      <DashboardInner />
    </RequireCompany>
  );
}
