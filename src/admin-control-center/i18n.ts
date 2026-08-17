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

  'analytics.notCollecting.title': 'لا توجد بيانات في هذه الفترة',
  'analytics.notCollecting.body': 'جدول الأحداث موجود ويعمل، لكن لم تُسجَّل زيارات ضمن الفترة المختارة. تذكّر أن التسجيل لا يبدأ إلا بعد موافقة الزائر على التتبّع. جرّب فترة أطول.',

  // shared table/field labels
  'f.type': 'النوع',
  'f.status': 'الحالة',
  'f.date': 'التاريخ',
  'f.amount': 'المبلغ',
  'f.customer': 'العميل',
  'f.service': 'الخدمة',
  'f.count': 'العدد',
  'f.total': 'الإجمالي',
  'f.commission': 'العمولة',
  'f.method': 'الطريقة',
  'f.action': 'الإجراء',
  'f.actor': 'المنفِّذ',
  'f.target': 'الهدف',
  'f.file': 'الملف',
  'f.size': 'الحجم',
  'f.task': 'المهمة',
  'f.page': 'الصفحة',
  'f.source': 'المصدر',

  // analytics
  'an.events': 'إجمالي الأحداث',
  'an.sessions': 'الزيارات (جلسات)',
  'an.signedIn': 'زيارات لمسجّلين',
  'an.pageViews': 'مشاهدات الصفحات',
  'an.funnel': 'مسار التحويل',
  'an.funnelHint': 'عدد الجلسات التي وصلت لكل مرحلة، والنسبة من المرحلة الأولى.',
  'an.topPages': 'أكثر الصفحات زيارة',
  'an.topReferrers': 'مصادر الزيارات',
  'an.devices': 'الأجهزة',
  'an.locales': 'اللغات',
  'an.topServices': 'أكثر الخدمات مشاهدة',
  'an.byType': 'الأحداث حسب النوع',
  'an.capped': 'تنبيه: بلغنا الحد الأقصى للصفوف المقروءة، فالأرقام أدناه حدّ أدنى وليست الإجمالي الكامل.',

  // operations
  'ops.total': 'إجمالي السجلات',
  'ops.open': 'مفتوحة (تحتاج إجراء)',
  'ops.overdue': 'متأخرة (أكثر من ٤٨ ساعة)',
  'ops.requests': 'طلبات خدمة',
  'ops.bookings': 'حجوزات',
  'ops.leads': 'عملاء محتملون',
  'ops.byStatus': 'حسب الحالة',
  'ops.recent': 'أحدث السجلات',
  'ops.openInAdmin': 'افتح في لوحة الإدارة',
  'ops.readOnlyNote': 'قراءة فقط — تغيير الحالة يتم من لوحة الإدارة القديمة عبر الرابط في كل صف، حتى لا تتكرر قواعد الحالات في مكانين.',

  // crm
  'crm.leadsTotal': 'إجمالي العملاء المحتملين',
  'crm.byKind': 'حسب النوع',
  'crm.recent': 'الأحدث',
  'crm.pipelineNote': 'مراحل المتابعة (مسؤول، ملاحظات، سبب الخسارة) تحتاج جدولاً جديداً في قاعدة البيانات — لم يُنشأ بعد، ولن أعرض حقولاً فارغة توحي بأنها تعمل.',

  // finance
  'fin.source.subscriptions': 'الاشتراكات',
  'fin.source.services': 'الخدمات',
  'fin.source.medical': 'السياحة الطبية',
  'fin.source.companies': 'الشركات',
  'fin.settled': 'محصَّل',
  'fin.waiting': 'معلّق',
  'fin.records': 'عدد العمليات',
  'fin.currencyNote': 'لا تُجمع العملات مع بعضها — كل عملة على حدة، لأن جمع الليرة مع الدولار يعطي رقماً غير صحيح.',
  'fin.actionsNote': 'لا يوجد هنا تأكيد أو رفض أو استرجاع — هذه إجراءات مالية حساسة تبقى في لوحة الإدارة القديمة.',

  // referrals
  'ref.referrers': 'عدد المُحيلين',
  'ref.commissions': 'العمولات',
  'ref.payouts': 'طلبات السحب',
  'ref.pending': 'معلّقة',
  'ref.available': 'متاحة',
  'ref.paid': 'مدفوعة',
  'ref.approveNote': 'اعتماد العمولات وصرف السحوبات إجراءات مالية — غير متاحة هنا عمداً.',

  // journey
  'jr.users': 'مستخدمون لديهم خطة',
  'jr.done': 'خطوات مكتملة',
  'jr.todo': 'خطوات متبقية',
  'jr.byTask': 'نسبة الإنجاز لكل خطوة',
  'jr.taskHint': 'الخطوة ذات النسبة الأدنى هي التي يتعثّر عندها المستخدمون.',

  // content
  'ct.listings': 'العقارات',
  'ct.investments': 'الفرص الاستثمارية',
  'ct.news': 'الأخبار',
  'ct.published': 'منشور',
  'ct.translated': 'مُترجَم',
  'ct.missingTranslations': 'بحاجة إلى ترجمة',

  // system health
  'sh.lastFxSuccess': 'آخر تحديث ناجح للأسعار',
  'sh.fxRates': 'أزواج العملات المحفوظة',
  'sh.failedRuns': 'محاولات فاشلة',
  'sh.runs': 'سجل مهام تحديث الأسعار',
  'sh.noSecrets': 'لا تُعرض هنا أي مفاتيح أو أسرار بيئة — حالة التشغيل فقط.',
  'sh.never': 'لم يحدث بعد',

  // documents
  'dc.files': 'عدد الملفات',
  'dc.size': 'المساحة الإجمالية',
  'dc.metadataOnly': 'بيانات وصفية فقط: الاسم والنوع والحجم والتاريخ. لا يوجد فتح ولا تنزيل ولا معاينة — كشف مستند مريض إجراء حسّاس يحتاج صلاحية صريحة وتسجيلاً في سجل التدقيق قبل إتاحته.',

  // notifications
  'nt.broadcasts': 'الإشعارات المُرسَلة',
  'nt.readOnlyNote': 'سجل قراءة فقط. لن يُرسل أي إشعار لمستخدم حقيقي من هنا.',

  // security
  'sec.recent': 'أحدث أحداث التدقيق',
  'sec.hint': 'من فعل ماذا ومتى — يشمل كشف بيانات، تغيير رتبة، تأكيد دفع، ونشر محتوى.',
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

  'analytics.notCollecting.title': 'No data in this period',
  'analytics.notCollecting.body': 'The events table exists and is working, but no visits were recorded in the selected period. Remember that nothing is recorded until a visitor accepts tracking. Try a longer period.',

  // shared table/field labels
  'f.type': 'Type',
  'f.status': 'Status',
  'f.date': 'Date',
  'f.amount': 'Amount',
  'f.customer': 'Customer',
  'f.service': 'Service',
  'f.count': 'Count',
  'f.total': 'Total',
  'f.commission': 'Commission',
  'f.method': 'Method',
  'f.action': 'Action',
  'f.actor': 'Actor',
  'f.target': 'Target',
  'f.file': 'File',
  'f.size': 'Size',
  'f.task': 'Task',
  'f.page': 'Page',
  'f.source': 'Source',

  // analytics
  'an.events': 'Total events',
  'an.sessions': 'Visits (sessions)',
  'an.signedIn': 'Signed-in visits',
  'an.pageViews': 'Page views',
  'an.funnel': 'Conversion funnel',
  'an.funnelHint': 'Sessions that reached each step, and the share of the first step.',
  'an.topPages': 'Most visited pages',
  'an.topReferrers': 'Traffic sources',
  'an.devices': 'Devices',
  'an.locales': 'Languages',
  'an.topServices': 'Most viewed services',
  'an.byType': 'Events by type',
  'an.capped': 'Note: the row cap was reached, so the figures below are a floor, not the complete total.',

  // operations
  'ops.total': 'Total records',
  'ops.open': 'Open (needs action)',
  'ops.overdue': 'Overdue (over 48h)',
  'ops.requests': 'Service requests',
  'ops.bookings': 'Bookings',
  'ops.leads': 'Leads',
  'ops.byStatus': 'By status',
  'ops.recent': 'Most recent',
  'ops.openInAdmin': 'Open in Admin',
  'ops.readOnlyNote': 'Read-only — status changes happen in the classic Admin via the link on each row, so status rules are never duplicated in two places.',

  // crm
  'crm.leadsTotal': 'Total leads',
  'crm.byKind': 'By kind',
  'crm.recent': 'Most recent',
  'crm.pipelineNote': 'Pipeline fields (owner, notes, lost reason) need a new database table that has not been created yet — empty fields that pretend to work will not be shown.',

  // finance
  'fin.source.subscriptions': 'Subscriptions',
  'fin.source.services': 'Services',
  'fin.source.medical': 'Medical tourism',
  'fin.source.companies': 'Companies',
  'fin.settled': 'Settled',
  'fin.waiting': 'Pending',
  'fin.records': 'Transactions',
  'fin.currencyNote': 'Currencies are never added together — each is reported separately, because summing TRY with USD produces a false number.',
  'fin.actionsNote': 'No verify, reject or refund here — those are sensitive money actions and stay in the classic Admin.',

  // referrals
  'ref.referrers': 'Referrers',
  'ref.commissions': 'Commissions',
  'ref.payouts': 'Payout requests',
  'ref.pending': 'Pending',
  'ref.available': 'Available',
  'ref.paid': 'Paid',
  'ref.approveNote': 'Approving commissions and releasing payouts are money actions — deliberately not available here.',

  // journey
  'jr.users': 'Users with a plan',
  'jr.done': 'Completed steps',
  'jr.todo': 'Remaining steps',
  'jr.byTask': 'Completion rate per step',
  'jr.taskHint': 'The step with the lowest rate is where users get stuck.',

  // content
  'ct.listings': 'Listings',
  'ct.investments': 'Investment opportunities',
  'ct.news': 'News',
  'ct.published': 'Published',
  'ct.translated': 'Translated',
  'ct.missingTranslations': 'Needs translation',

  // system health
  'sh.lastFxSuccess': 'Last successful rates update',
  'sh.fxRates': 'Stored currency pairs',
  'sh.failedRuns': 'Failed runs',
  'sh.runs': 'Rates sync run log',
  'sh.noSecrets': 'No environment keys or secrets are shown here — operational status only.',
  'sh.never': 'Never',

  // documents
  'dc.files': 'Files',
  'dc.size': 'Total size',
  'dc.metadataOnly': 'Metadata only: name, type, size and date. No open, download or preview — revealing a patient document is a sensitive action that needs an explicit permission and an audit entry before it is offered.',

  // notifications
  'nt.broadcasts': 'Sent notifications',
  'nt.readOnlyNote': 'Read-only history. No notification will ever be sent to a real user from here.',

  // security
  'sec.recent': 'Recent audit events',
  'sec.hint': 'Who did what and when — includes data reveals, role changes, payment approvals and content publishing.',
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
