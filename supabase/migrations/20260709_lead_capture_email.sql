-- ============================================================================
-- Rafiq Istanbul — lead-capture: optional email + instant webhook notify.  2026-07-09
-- Lets the no-login "Help me with this" flow (services + hub guides) collect an
-- optional email alongside the required name/whatsapp, and pings an external
-- webhook (Slack/Zapier/Make/anything) the moment a new lead lands so the team
-- doesn't have to poll the admin dashboard. Idempotent.
-- Run once in Supabase → SQL Editor.
-- ============================================================================

alter table public.service_requests
  add column if not exists email text;

-- pg_net is what Supabase's own Database Webhooks feature is built on; enabling
-- it here keeps this trigger portable/version-controlled instead of relying on
-- dashboard-only webhook config.
create extension if not exists pg_net;

-- Fires on every new lead. No-ops silently until app.lead_webhook_url is set, so
-- this is safe to deploy before you have a destination ready. Activate with:
--   alter database postgres set app.lead_webhook_url = 'https://hooks.slack.com/...';
-- (any URL that accepts a JSON POST works — Slack incoming webhook, Zapier
-- "Catch Hook", Make webhook, or your own endpoint.)
create or replace function public.notify_new_service_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  webhook_url text := current_setting('app.lead_webhook_url', true);
begin
  if webhook_url is not null and webhook_url <> '' then
    perform net.http_post(
      url := webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'name', new.name,
        'phone', new.phone,
        'email', new.email,
        'message', new.message,
        'service_title', new.service_title,
        'category', new.category,
        'service_type', new.service_type,
        'lang', new.lang,
        'created_at', new.created_at
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_service_request_notify on public.service_requests;
create trigger on_service_request_notify
  after insert on public.service_requests
  for each row execute function public.notify_new_service_request();
