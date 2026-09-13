#!/usr/bin/env python3
"""Audit level guidance without printing student PII.

This is a read-only aggregate check for the current roster and a Firebase
snapshot. Historical records have no lower/upper-secondary band, so all
progression recommendations remain staff-reviewable.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

THAI_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")


def normalize_name(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).lower().translate(THAI_DIGITS)
    return re.sub(r"[\s\-_/\.()]+", "", text)


def level(value: object) -> str:
    for candidate in ("เอก", "โท", "ตรี"):
        if candidate in str(value or ""):
            return candidate
    return ""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("roster_csv", type=Path)
    args = parser.parse_args()
    payload = json.loads(args.snapshot.read_text(encoding="utf-8"))
    records = payload.get("certificates", payload)
    if not isinstance(records, dict):
        raise SystemExit("expected an object under certificates")
    legacy = defaultdict(list)
    for raw in records.values():
        if isinstance(raw, dict):
            legacy[normalize_name(raw.get("fullName") or f"{raw.get('firstName', '')}{raw.get('lastName', '')}")].append(level(raw.get("level")))

    overall = Counter()
    by_grade = defaultdict(Counter)
    with args.roster_csv.open(newline="", encoding="utf-8-sig") as stream:
        for student in csv.DictReader(stream):
            grade = int(student["grade_level"])
            candidates = legacy.get(normalize_name(student["full_name"]), [])
            if grade in (1, 4):
                overall["required_tri"] += 1
                by_grade[grade]["required_tri"] += 1
            elif len(candidates) == 1 and candidates[0] == "ตรี":
                overall["suggested_tho"] += 1
                by_grade[grade]["suggested_tho"] += 1
            elif len(candidates) == 1 and candidates[0] == "โท":
                overall["suggested_ek"] += 1
                by_grade[grade]["suggested_ek"] += 1
            elif len(candidates) == 1 and candidates[0] == "เอก":
                overall["completed_ek"] += 1
                by_grade[grade]["completed_ek"] += 1
            elif len(candidates) > 1:
                overall["review_multiple"] += 1
                by_grade[grade]["review_multiple"] += 1
            else:
                overall["unmatched_or_tri_review"] += 1
                by_grade[grade]["unmatched_or_tri_review"] += 1
    print(json.dumps({"students": sum(overall.values()), "overall": dict(overall), "by_grade": {str(k): dict(v) for k, v in sorted(by_grade.items())}}, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
