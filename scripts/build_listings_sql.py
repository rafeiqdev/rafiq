import json
import re

IN = r"C:\Users\muhmm\Downloads\CLAUDE1\rafiq-istanbul\scripts\sahibinden_parsed.json"
OUT = r"C:\Users\muhmm\Downloads\CLAUDE1\rafiq-istanbul\supabase\migrations\20260802_import_sahibinden_listings.sql"

USD_TRY = 41  # approximate — adjust if you have a more current rate, then re-run
CITIZENSHIP_THRESHOLD_USD = 400_000  # Turkey's citizenship-by-investment minimum
# Nobody scrolls 60 photos. Also caps what a fresh import hotlinks from the
# source CDN before scripts/rehost-listing-photos.mjs replaces it with our
# own re-encoded WebP copies (which enforce the same cap independently).
MAX_IMAGES = 12


def esc(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def clean_desc(title, desc):
    desc = (desc or "").strip()
    desc = re.sub(r"\n{3,}", "\n\n", desc)
    desc = re.sub(r"[ \t]+", " ", desc)
    parts = []
    if title:
        parts.append(title.strip())
    if desc:
        parts.append(desc)
    return "\n\n".join(parts).strip()


def to_bool(v):
    return str(v).strip().lower() in ("true", "var", "evet")


def build_status(building_age):
    if building_age and "yapım" in building_age.lower():
        return "under-construction"
    return "ready"


def amenities_for(rec):
    out = []
    if to_bool(rec.get("furnished")):
        out.append("furnished")
    parking = (rec.get("parking") or "").strip().lower()
    if parking and parking != "yok":
        out.append("parking")
    if (rec.get("elevator") or "").strip().lower() == "var":
        out.append("elevator")
    features = [f.lower() for f in rec.get("features", [])]
    if any("güvenlik" in f or "kamera sistemi" in f for f in features):
        out.append("security")
    return out


def pg_text_array(items):
    if not items:
        return "'{}'"
    return "ARRAY[" + ", ".join(esc(i) for i in items) + "]::text[]"


def main():
    with open(IN, "r", encoding="utf-8") as f:
        recs = json.load(f)

    rows_sql = []
    for i, rec in enumerate(recs):
        district = rec.get("district") or rec.get("neighborhood") or "İstanbul"
        rooms = rec.get("rooms") or "1+1"
        net = rec.get("netSize") or rec.get("grossSize")
        m2 = int(float(net)) if net else 0
        price_try = rec.get("price")
        price_usd = int(round(float(price_try) / USD_TRY)) if price_try else 0
        citizenship = price_usd >= CITIZENSHIP_THRESHOLD_USD

        images = rec.get("images", [])[:MAX_IMAGES]
        image = images[0] if images else None

        description = clean_desc(rec.get("title"), rec.get("description"))
        bathrooms = rec.get("bathroomCount")
        bathrooms = int(bathrooms) if bathrooms else None
        furnished = to_bool(rec.get("furnished"))

        floor = rec.get("floor")
        floor = int(floor) if floor and str(floor).strip().isdigit() else None
        total_floors = rec.get("totalFloors")
        total_floors = int(total_floors) if total_floors and str(total_floors).strip().isdigit() else None

        bstatus = build_status(rec.get("buildingAge"))
        amenities = amenities_for(rec)
        updated_at = rec.get("updatedAt") or rec.get("listedAt")

        sort_val = 5000 + i * 10

        rows_sql.append(
            "  (\n"
            f"    {esc(district)}, {esc(rooms)}, {m2}, {price_usd}, {str(citizenship).lower()},\n"
            f"    {esc(image)}, {sort_val},\n"
            f"    {esc(description)}, {bathrooms if bathrooms is not None else 'NULL'}, {str(furnished).lower()}, {pg_text_array(images)},\n"
            f"    'sale', {floor if floor is not None else 'NULL'}, {total_floors if total_floors is not None else 'NULL'}, "
            f"{esc(bstatus)}, {pg_text_array(amenities)}, {esc(updated_at)}\n"
            "  )"
        )

    sql = f"""-- Import {len(recs)} sahibinden.com listings scraped {'2026-08-01'} into public.listings.
-- Source photos are hotlinked from sahibinden's own CDN (i0.shbdn.com /
-- image5.sahibinden.com) at insert time, capped at {MAX_IMAGES} per listing.
-- Run `node scripts/rehost-listing-photos.mjs` right after this migration —
-- it downloads each photo, re-encodes it to WebP and re-uploads it to our
-- own Supabase storage bucket, then rewrites images/image to point at our
-- URLs. Until that script runs, treat these hotlinked URLs as temporary: a
-- third-party CDN link can disappear or block hotlinking at any time, and
-- republishing another site's listing photos as our own carries a
-- ToS/copyright risk.
-- Run `node scripts/translate-listings.mjs` afterwards too, to fill in
-- listings.translations for the new rows.
--
-- priceUsd was converted from TRY at an approximate rate of {USD_TRY} TRY/USD —
-- correct individual prices from /admin if you have exact figures.
--
-- Idempotent column guards first, in case this database has not run the
-- earlier real-estate-revamp / description-bathrooms-furnished-images
-- migrations yet.

alter table public.listings
  add column if not exists description   text,
  add column if not exists bathrooms     int,
  add column if not exists furnished     boolean not null default false,
  add column if not exists images        text[] not null default '{{}}',
  add column if not exists listing_type  text not null default 'sale',
  add column if not exists floor         int,
  add column if not exists total_floors  int,
  add column if not exists build_status  text,
  add column if not exists yield_pct     numeric,
  add column if not exists amenities     text[] not null default '{{}}',
  add column if not exists updated_at    timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'listings_listing_type_chk') then
    alter table public.listings
      add constraint listings_listing_type_chk
      check (listing_type in ('sale', 'rent', 'commercial'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'listings_build_status_chk') then
    alter table public.listings
      add constraint listings_build_status_chk
      check (build_status is null or build_status in ('ready', 'under-construction'));
  end if;
end $$;

insert into public.listings
  (district, rooms, m2, price_usd, citizenship,
   image, sort,
   description, bathrooms, furnished, images,
   listing_type, floor, total_floors, build_status, amenities, updated_at)
values
{',\n'.join(rows_sql)};
"""

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(sql)

    print(f"Wrote {len(recs)} rows -> {OUT}")


if __name__ == "__main__":
    main()
