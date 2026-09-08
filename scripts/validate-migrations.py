# -*- coding: utf-8 -*-
"""
Validate a .sql migration with PostgreSQL's own parsers (via libpg_query):

  1. parse_sql        — every top-level statement's grammar
  2. parse_plpgsql_json — the BODY of every CREATE FUNCTION ... LANGUAGE plpgsql

Step 2 is the one that matters here: a function body is just a string literal
to the SQL grammar, so plain SQL parsing happily accepts nonsense inside $$…$$.
That is how "get diagnostics v_count = row count" (should be row_count) got
shipped and silently rolled the whole migration back in the SQL Editor.

Usage: python validate_sql.py <file.sql> [more.sql ...]
"""
import io
import re
import sys

from pglast import parser

# CREATE [OR REPLACE] FUNCTION ... AS $tag$ body $tag$ ... LANGUAGE plpgsql
# (language can come before or after the body, so it is checked separately).
FUNC_RE = re.compile(
    r"create\s+(?:or\s+replace\s+)?function\b(?P<head>.*?)"
    r"(?P<open>\$(?P<tag>[A-Za-z_]*)\$)(?P<body>.*?)(?P=open)",
    re.IGNORECASE | re.DOTALL,
)


def check_file(path):
    sql = io.open(path, encoding="utf-8").read()
    problems = []

    # 1. top-level grammar
    try:
        parser.parse_sql(sql)
    except Exception as exc:  # noqa: BLE001 - report whatever the parser says
        problems.append("SQL grammar: %s" % exc)

    # 2. each plpgsql body, through the real PL/pgSQL parser
    bodies = 0
    for m in FUNC_RE.finditer(sql):
        whole = m.group(0)
        after = sql[m.end():m.end() + 200]
        if "plpgsql" not in (m.group("head") + after).lower():
            continue  # sql / sql-language function, nothing to check
        bodies += 1
        name = re.search(r"[\w.]+\s*\(", m.group("head"))
        name = name.group(0).rstrip("(").strip() if name else "<anonymous>"
        line = sql[: m.start()].count("\n") + 1
        try:
            parser.parse_plpgsql_json(whole + ";")
        except Exception as exc:  # noqa: BLE001
            problems.append("plpgsql body of %s (line %d): %s" % (name, line, exc))

    return bodies, problems


def main(argv):
    if len(argv) < 2:
        print("usage: validate_sql.py <file.sql> [...]")
        return 2

    failed = False
    for path in argv[1:]:
        bodies, problems = check_file(path)
        if problems:
            failed = True
            print("FAIL  %s" % path)
            for p in problems:
                print("      - %s" % p)
        else:
            print("OK    %s  (%d plpgsql function bodies parsed)" % (path, bodies))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
