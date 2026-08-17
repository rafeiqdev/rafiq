/**
 * Module-local i18n for the Admin Control Center.
 *
 * WHY NOT the global locale files: the shared src/i18n/locales/*.json are guarded
 * by a parity test (every language must define exactly the same keys) and are
 * ~100 KB async chunks shipped to every visitor. Adding a whole admin-only
 * namespace to all four would be a large, risky diff on files this feature has
 * no business touching. Keeping the Control Center's strings here keeps the
 * module fully self-contained and additive — nothing outside this folder is
 * modified.
 *
 * Coverage: Arabic (primary) + English, per the brief ("support Arabic and
 * English, respecting RTL/LTR"). Russian/Farsi fall back to English so the UI
 * is never blank; they can be filled in later without changing call sites.
 * Direction is taken from the app's existing RTL_LANGS (ar/fa).
 */
import { useTranslation } from 'react-i18next';
import { RTL_LANGS } from '../i18n';
import type { Lang } from '../lib/types';

type Dict = Record<string, string>;

const ar: Dict = {
  'nav.backToAdmin': 'العودة إلى لوحة التحكم القديمة',
  'title': 'مركز التحكم والعمليات',
  'subtitle': 'طبقة قراءة وتحليل فوق النظام الحالي',
  'breadcrumb.admin': 'الإدارة',
  'breadcrumb.controlCenter': 'مركز التحكم',

  'section.overview': 'نظرة عامة',
  'section.analytics': 'التحليلات والرؤى',
  'section.operations': 'العمليات الموحدة',
  'section.crm': 'العملاء المحتملون',
  'section.notifications': 'الإشعارات',
  'section.documents': 'المستندات والخصوصية',
  'section.finance': 'مركز المالية',
  'section.journey': 'الرحلة والإعداد',
  'section.referrals': 'الإحالات والمحفظة',
  'section.content': 'المحتوى واللغات',
  'section.security': 'الأمان والتدقيق',
  'section.systemHealth': 'صحة النظام',

  'state.loading': 'جارٍ التحميل…',
  'state.error': 'تعذّر تحميل هذا القسم',
  'state.retry': 'إعادة المحاولة',
  'state.empty': 'لا توجد بيانات متاحة',
  'state.refresh': 'تحديث',
  'state.comingSoon': 'قيد التطوير — سيُضاف في مرحلة لاحقة',
  'state.comingSoonBody': 'هذا القسم محجوز ضمن بنية المركز الجديدة ولم يُفعّل بعد. لن يظهر أي رقم غير حقيقي هنا.',

  'period.today': 'اليوم',
  'period.yesterday': 'أمس',
  'period.7d': 'آخر ٧ أيام',
  'period.30d': 'آخر ٣٠ يومًا',
  'period.thisMonth': 'هذا الشهر',
  'period.lastMonth': 'الشهر الماضي',
  'period.label': 'الفترة',

  'overview.title': 'نظرة عامة',
  'overview.hint': 'قراءة فقط — الأرقام مأخوذة من الجداول الحقيقية عبر طبقة الخدمة نفسها التي تستخدمها لوحة الإدارة.',
  'overview.kpi.totalUsers': 'إجمالي المستخدمين',
  'overview.kpi.payingUsers': 'المستخدمون الدافعون',
  'overview.kpi.totalBookings': 'إجمالي الحجوزات',
  'overview.kpi.totalLeads': 'إجمالي الطلبات المحتملة',
  'overview.kpi.pendingPayments': 'المدفوعات المعلقة',
  'overview.kpi.cancellations': 'الاشتراكات الملغاة',
  'overview.card.needsAction': 'يحتاج إلى إجراء',
  'overview.card.recentAudit': 'أحدث أحداث التدقيق',
  'overview.viewDetails': 'عرض التفاصيل',
  'overview.notCounted': 'تعذّرت القراءة',

  'analytics.notCollecting.title': 'لا توجد بيانات تحليلات بعد',
  'analytics.notCollecting.body': 'جدول الأحداث (public.events) قد لا يكون مُنشأً في قاعدة البيانات الحية، أو لم تُجمَع بيانات بعد. لن تُعرض أرقام مُختلَقة. طبّق ترحيل الأحداث وابدأ التجميع لرؤية التقارير هنا.',
};

const en: Dict = {
  'nav.backToAdmin': 'Back to classic Admin',
  'title': 'Operations & Insights',
  'subtitle': 'A read & analysis layer on top of the existing system',
  'breadcrumb.admin': 'Admin',
  'breadcrumb.controlCenter': 'Control Center',

  'section.overview': 'Overview',
  'section.analytics': 'Analytics & Insights',
  'section.operations': 'Unified Operations',
  'section.crm': 'CRM & Leads',
  'section.notifications': 'Notifications',
  'section.documents': 'Documents & Privacy',
  'section.finance': 'Finance Control Center',
  'section.journey': 'Journey & Onboarding',
  'section.referrals': 'Referrals & Wallet',
  'section.content': 'Content & Localization',
  'section.security': 'Security & Audit',
  'section.systemHealth': 'System Health',

  'state.loading': 'Loading…',
  'state.error': 'This section could not load',
  'state.retry': 'Retry',
  'state.empty': 'No data available',
  'state.refresh': 'Refresh',
  'state.comingSoon': 'In progress — arrives in a later phase',
  'state.comingSoonBody': 'This section is reserved in the new Control Center structure and is not enabled yet. No invented numbers will ever appear here.',

  'period.today': 'Today',
  'period.yesterday': 'Yesterday',
  'period.7d': 'Last 7 days',
  'period.30d': 'Last 30 days',
  'period.thisMonth': 'This month',
  'period.lastMonth': 'Last month',
  'period.label': 'Period',

  'overview.title': 'Overview',
  'overview.hint': 'Read-only — figures come from the real tables via the same service layer the classic Admin uses.',
  'overview.kpi.totalUsers': 'Total users',
  'overview.kpi.payingUsers': 'Paying users',
  'overview.kpi.totalBookings': 'Total bookings',
  'overview.kpi.totalLeads': 'Total leads',
  'overview.kpi.pendingPayments': 'Pending payments',
  'overview.kpi.cancellations': 'Cancelled subscriptions',
  'overview.card.needsAction': 'Needs action',
  'overview.card.recentAudit': 'Recent audit events',
  'overview.viewDetails': 'View details',
  'overview.notCounted': 'Unreadable',

  'analytics.notCollecting.title': 'No analytics data yet',
  'analytics.notCollecting.body': 'The events table (public.events) may not exist in the live database, or no data has been collected yet. No fabricated numbers are shown. Apply the events migration and start collecting to see reports here.',
};

const DICTS: Record<Lang, Dict> = { ar, en, ru: en, fa: en };

export function ccDir(lang: string): 'rtl' | 'ltr' {
  return RTL_LANGS.includes(lang as Lang) ? 'rtl' : 'ltr';
}

/** Translate a Control-Center key for a given language, falling back en → ar → key. */
export function ccTranslate(lang: string, key: string): string {
  const dict = DICTS[(lang as Lang)] ?? en;
  return dict[key] ?? en[key] ?? ar[key] ?? key;
}

/** Hook: returns a scoped translator + current language + direction. */
export function useCC() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'ar').split('-')[0];
  return {
    lang,
    dir: ccDir(lang),
    cc: (key: string) => ccTranslate(lang, key),
  };
}
