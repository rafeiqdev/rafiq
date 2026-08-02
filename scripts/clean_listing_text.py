import json
import re

IN = r"C:\Users\muhmm\Downloads\CLAUDE1\rafiq-istanbul\scripts\sahibinden_parsed.json"
OUT_SQL = r"C:\Users\muhmm\Downloads\CLAUDE1\rafiq-istanbul\supabase\migrations\20260803_fix_sahibinden_listings.sql"

MAX_IMAGES = 8
MAX_DESC_CHARS = 480
OLD_USD_TRY = 41  # rate the original import used — needed to match existing rows
NEW_USD_TRY = 47.54  # the site's own live ticker rate at the time of this fix
CITIZENSHIP_THRESHOLD_USD = 400_000

SPAM_MARKERS = [
    "telefon", "irtibat", "randevu", "ofisimiz", "www.", "http", "sizi ev sahibi",
    "kira öder gibi", "kredi", "danışman", "iletişime geç", "bize ulaş",
    "hafta 7 gün", "adres:", "adresimiz", "merkez ofis", "cad no", "sok no",
]


def is_spammy(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return True
    low = stripped.lower()
    if any(m in low for m in SPAM_MARKERS):
        return True
    if re.search(r"0\d{3}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}", stripped):
        return True
    letters = [c for c in stripped if c.isalpha()]
    if letters:
        upper_ratio = sum(1 for c in letters if c.isupper()) / len(letters)
        if upper_ratio > 0.7 and len(letters) > 12:
            return True
    if stripped.count("!") >= 2 or stripped.count("✧") or stripped.count("★"):
        return True
    return False


def clean_description(title, raw):
    raw = raw or ""
    lines = [l.strip() for l in raw.split("\n")]
    good = [l for l in lines if l and not is_spammy(l)]

    text = " ".join(good)
    text = re.sub(r"\s+", " ", text).strip()

    # Cut at a sentence boundary near the char cap instead of mid-word.
    if len(text) > MAX_DESC_CHARS:
        cut = text[:MAX_DESC_CHARS]
        last_dot = max(cut.rfind(". "), cut.rfind("İ. "), cut.rfind("! "))
        text = (cut[: last_dot + 1] if last_dot > 100 else cut).strip()
        if not text.endswith((".", "…")):
            text += "…"

    # Ad copy that was almost entirely spam markers leaves a short, incoherent
    # fragment behind (e.g. "ÇIKARTIYORUZ 2+1 105M2 ULAŞIM") — better to show
    # nothing than a scrap that reads like garbled text.
    if len(text.split()) < 6:
        text = ""

    parts = []
    if title:
        parts.append(title.strip())
    if text:
        parts.append(text)
    return "\n\n".join(parts).strip()


def esc(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def pg_text_array(items):
    if not items:
        return "'{}'"
    return "ARRAY[" + ", ".join(esc(i) for i in items) + "]::text[]"


def main():
    with open(IN, "r", encoding="utf-8") as f:
        recs = json.load(f)

    updates = []
    for rec in recs:
        district = rec.get("district") or "İstanbul"
        rooms = rec.get("rooms") or "1+1"
        net = rec.get("netSize") or rec.get("grossSize")
        m2 = int(float(net)) if net else 0
        price_try = rec.get("price")
        old_price_usd = int(round(float(price_try) / OLD_USD_TRY)) if price_try else 0
        new_price_usd = int(round(float(price_try) / NEW_USD_TRY)) if price_try else 0
        citizenship = new_price_usd >= CITIZENSHIP_THRESHOLD_USD

        desc = clean_description(rec.get("title"), rec.get("description"))
        images = rec.get("images", [])[:MAX_IMAGES]
        image = images[0] if images else None

        updates.append(
            "update public.listings set\n"
            f"  description = {esc(desc)},\n"
            f"  images = {pg_text_array(images)},\n"
            f"  image = {esc(image)},\n"
            f"  price_usd = {new_price_usd},\n"
            f"  citizenship = {str(citizenship).lower()}\n"
            f"where district = {esc(district)} and rooms = {esc(rooms)} "
            f"and m2 = {m2} and price_usd = {old_price_usd};"
        )

    sql = (
        "-- Follow-up fix for the sahibinden import (20260802_import_sahibinden_listings.sql):\n"
        "-- descriptions carried the FULL scraped text (marketing spam, phone numbers,\n"
        "-- tourist-guide walls of text), and some listings kept 20-60 hotlinked photos,\n"
        "-- which is what caused the oversized/unusable photo strip and the layout\n"
        "-- overflow on the listing detail page. This trims each description down to a\n"
        "-- short, real summary and caps photos at 8 per listing.\n"
        "--\n"
        f"-- It also corrects price_usd: the original import used an approximate\n"
        f"-- {OLD_USD_TRY} TRY/USD rate; this recomputes at {NEW_USD_TRY} (the site's own live\n"
        "-- FX ticker rate), and re-checks the citizenship-threshold flag against it.\n"
        "--\n"
        "-- Matches rows by (district, rooms, m2, price_usd) using the OLD price_usd,\n"
        "-- which is still a unique combination across the 20 imported rows.\n\n"
        + "\n\n".join(updates)
        + "\n"
    )

    with open(OUT_SQL, "w", encoding="utf-8") as f:
        f.write(sql)

    print(f"Wrote {len(updates)} updates -> {OUT_SQL}")


if __name__ == "__main__":
    main()
