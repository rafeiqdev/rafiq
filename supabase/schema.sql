-- ============================================================================
-- Rafiq Istanbul — Supabase schema + Row-Level Security
-- Run this once in the Supabase dashboard → SQL Editor → New query → Run.
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE where possible).
-- ============================================================================

-- ---------- helpers ----------------------------------------------------------

-- Is the current user an admin? (used by RLS policies)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- Does the current user have a paid (pro/elite) active subscription?
create or replace function public.has_pro()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = auth.uid()
      and s.tier in ('pro','elite')
      and s.status in ('active','cancelled')
      and s.expires_at > now()
  );
$$;

-- ---------- profiles (1:1 with auth.users) -----------------------------------

create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  email         text,
  name          text,
  role          text not null default 'user',          -- 'user' | 'admin'
  referral_code text unique,
  referred_by   uuid references public.profiles(id),
  onboarding    jsonb,                                  -- the dynamic profile (path/reason/has/family/...)
  created_at    timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles read own/admin" on public.profiles;
create policy "profiles read own/admin" on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- prevent non-admins from escalating their own role
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end; $$;
drop trigger if exists trg_guard_role on public.profiles;
create trigger trg_guard_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- auto-create a profile when a new auth user signs up (email or Google)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare ref_id uuid;
begin
  -- attribute referral if the signup carried a ref code in user metadata
  select id into ref_id from public.profiles
   where referral_code = upper(coalesce(new.raw_user_meta_data->>'ref_code',''))
   limit 1;

  insert into public.profiles (id, email, name, role, referral_code, referred_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)),
    -- bootstrap admins here (edit the list to taste)
    case when lower(new.email) in ('rafeiq.dev@gmail.com','admin@rafiq.ist') then 'admin' else 'user' end,
    upper(substr(md5(random()::text || new.id::text), 1, 6)),
    ref_id
  )
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- subscriptions ----------------------------------------------------

create table if not exists public.subscriptions (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  tier       text not null,                              -- light | pro | elite
  billing    text not null default 'monthly',            -- monthly | annual
  status     text not null default 'active',             -- active | cancelled | expired
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  cancel_reason text, cancel_comment text
);
alter table public.subscriptions enable row level security;
drop policy if exists "subs read own/admin" on public.subscriptions;
create policy "subs read own/admin" on public.subscriptions for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "subs admin write" on public.subscriptions;
create policy "subs admin write" on public.subscriptions for all using (public.is_admin()) with check (public.is_admin());

-- ---------- real-estate listings (public catalogue, admin-managed) ----------

create table if not exists public.listings (
  id          uuid primary key default gen_random_uuid(),
  district    text not null,
  rooms       text not null,
  m2          int  not null,
  price_usd   int  not null,
  citizenship boolean not null default false,
  image       text,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.listings enable row level security;
drop policy if exists "listings public read" on public.listings;
create policy "listings public read" on public.listings for select using (true);
drop policy if exists "listings admin write" on public.listings;
create policy "listings admin write" on public.listings for all using (public.is_admin()) with check (public.is_admin());

-- ---------- map services / places (Pro-gated read, admin-managed) -----------

create table if not exists public.places (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  category   text not null,                              -- dining|hotels|notary|hospitals|government|shopping
  lat        double precision not null,
  lng        double precision not null,
  address    text,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.places enable row level security;
drop policy if exists "places pro read" on public.places;
create policy "places pro read" on public.places for select using (public.has_pro() or public.is_admin());
drop policy if exists "places admin write" on public.places;
create policy "places admin write" on public.places for all using (public.is_admin()) with check (public.is_admin());

-- ---------- bookings ---------------------------------------------------------

create table if not exists public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  user_email         text,
  problem_summary    text not null,
  transcript         jsonb not null default '[]',
  preferred_datetime timestamptz not null,
  preferred_language text not null,
  status             text not null default 'new',        -- new|confirmed|done|cancelled
  internal_note      text,
  created_at         timestamptz not null default now()
);
alter table public.bookings enable row level security;
drop policy if exists "bookings own read" on public.bookings;
create policy "bookings own read" on public.bookings for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "bookings own insert" on public.bookings;
create policy "bookings own insert" on public.bookings for insert with check (user_id = auth.uid());
drop policy if exists "bookings admin update" on public.bookings;
create policy "bookings admin update" on public.bookings for update using (public.is_admin()) with check (public.is_admin());

-- ---------- leads (real-estate / health / help requests) --------------------

create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  user_email text,
  kind       text not null,                              -- realestate|health|help
  item       text not null,
  status     text not null default 'new',
  created_at timestamptz not null default now()
);
alter table public.leads enable row level security;
drop policy if exists "leads own read" on public.leads;
create policy "leads own read" on public.leads for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "leads own insert" on public.leads;
create policy "leads own insert" on public.leads for insert with check (user_id = auth.uid());
drop policy if exists "leads admin update" on public.leads;
create policy "leads admin update" on public.leads for all using (public.is_admin()) with check (public.is_admin());

-- ---------- referrals --------------------------------------------------------

create table if not exists public.referral_clicks (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  created_at timestamptz not null default now()
);
alter table public.referral_clicks enable row level security;
drop policy if exists "clicks anyone insert" on public.referral_clicks;
create policy "clicks anyone insert" on public.referral_clicks for insert with check (true);
drop policy if exists "clicks admin read" on public.referral_clicks;
create policy "clicks admin read" on public.referral_clicks for select using (public.is_admin());

create table if not exists public.referral_credits (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references public.profiles(id) on delete cascade,
  payment_id text unique,
  amount_tl int not null,
  created_at timestamptz not null default now()
);
alter table public.referral_credits enable row level security;
drop policy if exists "credits own read" on public.referral_credits;
create policy "credits own read" on public.referral_credits for select using (referrer_id = auth.uid() or public.is_admin());

-- ---------- notifications ----------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null,                                -- user|all|admins
  user_id uuid references public.profiles(id) on delete cascade,
  key text not null,
  custom_text text,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
drop policy if exists "notif visible" on public.notifications;
create policy "notif visible" on public.notifications for select using (
  audience = 'all'
  or (audience = 'user'   and user_id = auth.uid())
  or (audience = 'admins' and public.is_admin())
);
drop policy if exists "notif admin write" on public.notifications;
create policy "notif admin write" on public.notifications for insert with check (public.is_admin());

create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (notification_id, user_id)
);
alter table public.notification_reads enable row level security;
drop policy if exists "reads own" on public.notification_reads;
create policy "reads own" on public.notification_reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- documents (metadata; files live in Supabase Storage) ------------

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  storage_path text not null,
  mime text, size int,
  created_at timestamptz not null default now()
);
alter table public.documents enable row level security;
drop policy if exists "docs own" on public.documents;
create policy "docs own" on public.documents for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid());

-- ---------- settings (admin currency-rate override, etc.) -------------------

create table if not exists public.settings (
  key text primary key,
  value jsonb not null
);
alter table public.settings enable row level security;
drop policy if exists "settings public read" on public.settings;
create policy "settings public read" on public.settings for select using (true);
drop policy if exists "settings admin write" on public.settings;
create policy "settings admin write" on public.settings for all using (public.is_admin()) with check (public.is_admin());

-- ---------- ai usage (free-preview counter) ---------------------------------

create table if not exists public.ai_usage (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  count int not null default 0
);
alter table public.ai_usage enable row level security;
drop policy if exists "ai own" on public.ai_usage;
create policy "ai own" on public.ai_usage for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- seed demo content (idempotent) ----------------------------------

insert into public.listings (district, rooms, m2, price_usd, citizenship, image, sort)
select * from (values
  ('Kadıköy','2+1',95,210000,false,'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=70',0),
  ('Beşiktaş','3+1',140,460000,true,'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=70',1),
  ('Başakşehir','2+1',110,185000,false,'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=70',2),
  ('Sarıyer','4+1',220,690000,true,'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=70',3),
  ('Beylikdüzü','1+1',65,95000,false,'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=70',4),
  ('Üsküdar','3+1',150,420000,true,'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=70',5)
) as v(district,rooms,m2,price_usd,citizenship,image,sort)
where not exists (select 1 from public.listings);

insert into public.places (name, category, lat, lng, address, sort)
select * from (values
  ('Çiya Sofrası (Kadıköy)','dining',40.9905,29.0253,'Caferağa, Kadıköy',0),
  ('Pera Palace Hotel','hotels',41.0316,28.9751,'Tepebaşı, Beyoğlu',1),
  ('Beyoğlu 25. Noter','notary',41.0335,28.9772,'İstiklal Cd., Beyoğlu',2),
  ('Acıbadem Hospital','hospitals',40.9991,29.0407,'Acıbadem, Kadıköy',3),
  ('Göç İdaresi','government',41.0167,28.9497,'Fatih',4),
  ('Grand Bazaar','shopping',41.0106,28.968,'Beyazıt, Fatih',5)
) as v(name,category,lat,lng,address,sort)
where not exists (select 1 from public.places);

-- ============================================================================
-- After running: enable the Google provider in Authentication → Providers,
-- and (optional) create a Storage bucket named "documents" (private) for the
-- document locker. See SUPABASE-SETUP.md.
-- ============================================================================
