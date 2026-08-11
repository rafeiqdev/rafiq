-- ============================================================================
-- Admin control over /health-tourism landing-page content + media. 2026-08-11
--
-- Until now the landing page (HealthTourism.tsx / MobileHealthTourism.tsx)
-- was a literal 1:1 port of the client's HTML mockup: the marketing
-- "specialties" showcase cards (5 curated cards with photo + copy) and the
-- hero before/after carousel were hardcoded in i18n JSON and static /public
-- files, with no admin control at all.
--
-- This is deliberately a NEW pair of tables, not a reuse of the existing
-- medical_specialties / medical_services tables: those feed the specialty
-- dropdown on the "submit a request" form (a different, longer, photo-less
-- list — see medical_specialties seed in 20260806_medical_tourism.sql) and
-- must not be disturbed by this landing-page-only feature.
--
--   1. medical_landing_cards   — the showcase cards (title/description/image)
--   2. medical_hero_slides     — the hero before/after carousel
--   3. 'medical-media' public storage bucket, admin/coordinator-write, for
--      uploading both from the admin panel.
--
-- Both tables are seeded from the current hardcoded content so nothing
-- regresses visually the moment this migration lands; admin can then edit/
-- replace/reorder everything from AdminMedical > Content.
-- Idempotent.
-- ============================================================================

create table if not exists public.medical_landing_cards (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       jsonb not null default '{}'::jsonb,
  description jsonb not null default '{}'::jsonb,
  image_url   text,
  sort        int not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.medical_hero_slides (
  id         uuid primary key default gen_random_uuid(),
  image_url  text not null,
  caption    jsonb not null default '{}'::jsonb,
  sort       int not null default 0,
  visible    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['medical_landing_cards','medical_hero_slides'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s public read" on public.%I', t, t);
    execute format('drop policy if exists "%s staff write" on public.%I', t, t);
    execute format('create policy "%s public read" on public.%I for select using (visible or public.is_medical_staff())', t, t);
    execute format('create policy "%s staff write" on public.%I for all using (public.is_medical_staff()) with check (public.is_medical_staff())', t, t);
  end loop;
end $$;

drop trigger if exists medical_landing_cards_touch on public.medical_landing_cards;
create trigger medical_landing_cards_touch before update on public.medical_landing_cards for each row execute function public.touch_updated_at();
drop trigger if exists medical_hero_slides_touch on public.medical_hero_slides;
create trigger medical_hero_slides_touch before update on public.medical_hero_slides for each row execute function public.touch_updated_at();

-- seed: the 5 showcase cards, verbatim from the previously-hardcoded
-- medical.landing.desktop.specialties.items i18n copy.
insert into public.medical_landing_cards (slug, title, description, image_url, sort) values
  ('hair',
   '{"en":"Hair transplant and thickening","ar":"زراعة الشعر وتكثيف البصيلات","ru":"Пересадка и уплотнение волос","fa":"کاشت و پرپشت کردن مو"}',
   '{"en":"The latest FUE and DHI techniques for 100% natural results with a lifetime warranty and a professionally thickened look.","ar":"أحدث تقنيات FUE و DHI لنتائج طبيعية 100% مع شهادة ضمان مد الحياة وتكثيف المظهر بأسلوب احترافي.","ru":"Новейшие техники FUE и DHI для на 100% естественных результатов с пожизненной гарантией и профессионально плотным видом.","fa":"جدیدترین تکنیک‌های FUE و DHI برای نتایج ۱۰۰٪ طبیعی با ضمانت مادام‌العمر و ظاهری حرفه‌ای پرپشت."}',
   '/img/health-tourism/specialty_hair.jpg', 0),
  ('dental',
   '{"en":"Cosmetic dentistry and smile design","ar":"تجميل وابتسامة الأسنان","ru":"Косметическая стоматология и дизайн улыбки","fa":"زیبایی دندان و طراحی لبخند"}',
   '{"en":"E-max veneers, a bright Hollywood smile, and dental implants at the highest standards of precision and medical quality.","ar":"عدسات E-max ابتسامة هوليوود الناصعة وزراعة الأسنان بأعلى معايير الدقة والجودة الطبية.","ru":"Виниры E-max, яркая голливудская улыбка и зубные импланты с высочайшими стандартами точности и медицинского качества.","fa":"لمینت‌های E-max، لبخند هالیوودی درخشان و ایمپلنت دندان با بالاترین استانداردهای دقت و کیفیت پزشکی."}',
   '/img/health-tourism/specialty_dental.jpg', 1),
  ('bariatric',
   '{"en":"Bariatric surgery and gastric sleeve","ar":"جراحة السمنة والتكميم","ru":"Бариатрическая хирургия и рукавная гастропластика","fa":"جراحی چاقی و اسلیو معده"}',
   '{"en":"Laparoscopic gastric sleeve and revision surgery under the supervision of Turkey’s top accredited hospital surgeons.","ar":"عمليات تكميم وتلافي المعدة بالمنظار تحت إشراف نخبة كبار الجراحين في مستشفيات تركيا المعتمدة.","ru":"Лапароскопическая рукавная гастропластика и повторные операции под наблюдением ведущих хирургов аккредитованных больниц Турции.","fa":"اسلیو معده لاپاراسکوپی و جراحی اصلاحی تحت نظارت برترین جراحان بیمارستان‌های معتبر ترکیه."}',
   '/img/health-tourism/specialty_bariatric.jpg', 2),
  ('eye',
   '{"en":"Ophthalmology and LASIK surgery","ar":"طب وجراحة العيون والليزك","ru":"Офтальмология и лазерная коррекция","fa":"چشم‌پزشکی و جراحی لیزیک"}',
   '{"en":"Vision correction with Femto-LASIK and cataract surgery using the latest advanced German equipment.","ar":"تصحيح النظر بالفيمتو ليزك وجراحات المياه البيضاء بأحدث الأجهزة الألمانية المتقدمة.","ru":"Коррекция зрения методом Фемто-ЛАСИК и операции по удалению катаракты на новейшем немецком оборудовании.","fa":"اصلاح بینایی با فمتو-لیزیک و جراحی آب مروارید با جدیدترین تجهیزات پیشرفته آلمانی."}',
   '/img/health-tourism/specialty_eye.jpg', 3),
  ('cosmetic',
   '{"en":"Cosmetic surgery and body contouring","ar":"الجراحة التجميلية ونحت القوام","ru":"Пластическая хирургия и контурирование тела","fa":"جراحی زیبایی و فرم‌دهی بدن"}',
   '{"en":"Body contouring, rhinoplasty, and jaw surgery under the supervision of elite consultants in Istanbul.","ar":"جراحات نحت القوام، وتجميل الأنف، وتعديل الفك تحت إشراف نخبة الاستشاريين في إسطنبول.","ru":"Контурирование тела, ринопластика и операции на челюсти под наблюдением элитных консультантов в Стамбуле.","fa":"فرم‌دهی بدن، جراحی بینی و جراحی فک تحت نظارت مشاوران برجسته در استانبول."}',
   '/img/health-tourism/specialty_cosmetic.jpg', 4)
on conflict (slug) do nothing;

-- seed: the 4 hero before/after slides, verbatim from the previously-
-- hardcoded medical.landing.heroBeforeAfter.slides i18n copy.
insert into public.medical_hero_slides (image_url, caption, sort) values
  ('/img/health-tourism/hero_before_after_hair.jpg', '{"en":"Hair transplant • precise FUE technique","ar":"زراعة الشعر • تقنية FUE الدقيقة","ru":"Пересадка волос • точная техника FUE","fa":"کاشت مو • تکنیک دقیق FUE"}', 0),
  ('/img/health-tourism/hero_before_after_dental.jpg', '{"en":"Dental veneers • Hollywood smile E-max","ar":"فينير الأسنان • ابتسامة هوليوود E-max","ru":"Виниры • голливудская улыбка E-max","fa":"لمینت دندان • لبخند هالیوودی E-max"}', 1),
  ('/img/health-tourism/hero_before_after_rhinoplasty.jpg', '{"en":"Rhinoplasty • natural results","ar":"تجميل الأنف • نتائج طبيعية","ru":"Ринопластика • естественные результаты","fa":"جراحی بینی • نتایج طبیعی"}', 2),
  ('/img/health-tourism/hero_before_after_jaw.jpg', '{"en":"Orthognathic jaw surgery","ar":"جراحة تقويم الفكين","ru":"Ортогнатическая хирургия челюсти","fa":"جراحی ارتوگناتیک فک"}', 3)
on conflict do nothing;

insert into storage.buckets (id, name, public) values ('medical-media', 'medical-media', true)
on conflict (id) do nothing;

drop policy if exists "medical-media staff insert" on storage.objects;
create policy "medical-media staff insert" on storage.objects for insert
  with check (bucket_id = 'medical-media' and public.is_medical_staff());
drop policy if exists "medical-media staff update" on storage.objects;
create policy "medical-media staff update" on storage.objects for update
  using (bucket_id = 'medical-media' and public.is_medical_staff())
  with check (bucket_id = 'medical-media' and public.is_medical_staff());
drop policy if exists "medical-media staff delete" on storage.objects;
create policy "medical-media staff delete" on storage.objects for delete
  using (bucket_id = 'medical-media' and public.is_medical_staff());

-- verify (run manually):
-- select count(*) from public.medical_landing_cards;             -- expect 5
-- select count(*) from public.medical_hero_slides;                -- expect 4
