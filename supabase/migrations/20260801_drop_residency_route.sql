-- ============================================================================
-- Rafiq Istanbul — the standalone /residency page was removed from the app.
-- 2026-08-01
--
-- ensure_my_journey() (see 20260718_user_journey.sql) seeds a 'residencePermit'
-- checklist item whose CTA pointed at '/residency'. That route no longer
-- exists, so:
--   1. redefine the function so newly-seeded rows point at '/services' instead
--   2. backfill existing user_journey_items rows that still point at the old route
-- Idempotent; safe to re-run.
-- ============================================================================

update public.user_journey_items
   set related_route = '/services'
 where related_route = '/residency';

create or replace function public.ensure_my_journey()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_has jsonb;
  v_done boolean;
  r record;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select coalesce(onboarding->'has', '{}'::jsonb) into v_has
    from public.profiles where id = v_uid;
  v_has := coalesce(v_has, '{}'::jsonb);

  for r in
    select * from (values
      ('turkishPhone',   'الحصول على رقم هاتف تركي', 'شريحة تركية باسمك — تحتاجها لتفعيل الحسابات والتطبيقات الرسمية.', 1, '/services?q=%D8%B4%D8%B1%D9%8A%D8%AD%D8%A9', 'tel-sim'),
      ('taxNumber',      'استخراج الرقم الضريبي',   'رقم ضريبي (Vergi No) — مطلوب لفتح حساب بنكي وأغلب المعاملات.', 2, '/services?q=%D8%B6%D8%B1%D9%8A%D8%A8%D9%8A',   'res-tax'),
      ('residencePermit','مراجعة وضع الإقامة',      'تحقّق من إقامتك: تقديم أول مرة أو تجديد قبل انتهاء الصلاحية.',   3, '/services',                                    'res-tourist'),
      ('bankAccount',    'فتح حساب بنكي',           'حساب بنكي تركي لاستقبال التحويلات ودفع الفواتير.',                4, '/services?q=%D8%A8%D9%86%D9%83',              'bank-account')
    ) as t(task_key, title_ar, description_ar, sort, related_route, related_service_id)
  loop
    v_done := coalesce((v_has ->> r.task_key)::boolean, false);
    insert into public.user_journey_items
      (user_id, task_key, title_ar, description_ar, status, sort, related_route, related_service_id, completed_at)
    values
      (v_uid, r.task_key, r.title_ar, r.description_ar,
       case when v_done then 'done' else 'todo' end,
       r.sort, r.related_route, r.related_service_id,
       case when v_done then now() else null end)
    on conflict (user_id, task_key) do update
       set status = 'done'
     where excluded.status = 'done'
       and user_journey_items.status = 'todo';
  end loop;
end;
$$;
