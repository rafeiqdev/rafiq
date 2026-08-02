import html
import json
import re
import sys
from html.parser import HTMLParser

SRC = r"C:\Users\muhmm\Downloads\dataset_sahibinden-real-estate_2026-08-01_21-40-10-707.html"
OUT = r"C:\Users\muhmm\Downloads\CLAUDE1\rafiq-istanbul\scripts\sahibinden_parsed.json"


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.cur_row = None
        self.cur_cell = None
        self.in_pre = False
        self.in_head = False

    def handle_starttag(self, tag, attrs):
        if tag == "thead":
            self.in_head = True
        elif tag == "tr":
            self.cur_row = []
        elif tag in ("td", "th"):
            self.cur_cell = []
        elif tag == "pre":
            self.in_pre = True

    def handle_endtag(self, tag):
        if tag == "thead":
            self.in_head = False
        elif tag == "tr":
            if self.cur_row is not None:
                self.rows.append((self.in_head, self.cur_row))
            self.cur_row = None
        elif tag in ("td", "th"):
            if self.cur_cell is not None and self.cur_row is not None:
                text = "".join(self.cur_cell).strip()
                self.cur_row.append(text)
            self.cur_cell = None
        elif tag == "pre":
            self.in_pre = False

    def handle_data(self, data):
        if self.cur_cell is not None:
            self.cur_cell.append(data)


def main():
    with open(SRC, "r", encoding="utf-8") as f:
        content = f.read()

    parser = TableParser()
    parser.feed(content)

    header = None
    records = []
    for is_head, row in parser.rows:
        if is_head or header is None:
            header = row
            continue
        rec = {}
        for i, val in enumerate(row):
            if i >= len(header):
                break
            key = header[i]
            if val == "":
                continue
            rec[key] = val
        records.append(rec)

    # Collapse features/N and images/N into arrays
    out_records = []
    for rec in records:
        features = []
        images = []
        clean = {}
        for k, v in rec.items():
            if k.startswith("features/"):
                features.append(v)
            elif k.startswith("images/"):
                images.append(v)
            elif k.startswith("sellerVerification/"):
                pass
            else:
                clean[k] = v
        clean["features"] = features
        clean["images"] = images
        out_records.append(clean)

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out_records, f, ensure_ascii=False, indent=2)

    print(f"Parsed {len(out_records)} records -> {OUT}")


if __name__ == "__main__":
    main()
