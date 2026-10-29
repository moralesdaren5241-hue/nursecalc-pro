#!/usr/bin/env python3
"""Check store/listing.md text blocks against Google Play's character limits."""
import re
import sys
from pathlib import Path

LIMITS = {"App name": 30, "Short description": 80, "Full description": 4000, "Release notes": 500}
text = Path(__file__).resolve().parent.parent.joinpath("store", "listing.md").read_text(encoding="utf-8")
failed = False
for heading, limit in LIMITS.items():
    m = re.search(r"^## " + re.escape(heading) + r".*?\n```\n(.*?)\n```", text, re.S | re.M)
    if not m:
        print(f"MISSING  {heading}")
        failed = True
        continue
    n = len(m.group(1))
    ok = n <= limit
    failed |= not ok
    print(f"{'OK  ' if ok else 'OVER'}  {heading}: {n}/{limit}")
sys.exit(1 if failed else 0)
