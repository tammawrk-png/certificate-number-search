#!/usr/bin/env python3
"""Audit a Firebase certificate snapshot without printing personal records."""
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path


THAI_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")


def normalize(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).lower().translate(THAI_DIGITS)
    return re.sub(r"[\s\-_/\.()]+", "", text)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", type=Path)
    args = parser.parse_args()
    payload = json.loads(args.snapshot.read_text(encoding="utf-8"))
    records = payload.get("certificates", payload)
    if not isinstance(records, dict):
        raise SystemExit("expected an object under certificates")

    names = []
    levels = Counter()
    education = Counter()
    years = Counter()
    missing_certificate_no = 0
    for raw in records.values():
        if not isinstance(raw, dict):
            continue
        name = raw.get("fullName") or f"{raw.get('firstName', '')}{raw.get('lastName', '')}"
        names.append(normalize(name))
        levels[str(raw.get("level") or "(missing)")] += 1
        education[str(raw.get("educationLevel") or "(missing)")] += 1
        years[str(raw.get("examYear") or "(missing)")] += 1
        if not str(raw.get("certificateNo") or "").strip():
            missing_certificate_no += 1

    duplicates = sum(count - 1 for count in Counter(name for name in names if name).values() if count > 1)
    print(json.dumps({
        "snapshot": str(args.snapshot),
        "records": len(records),
        "records_with_names": sum(bool(name) for name in names),
        "duplicate_normalized_name_rows": duplicates,
        "missing_certificate_no": missing_certificate_no,
        "levels": dict(sorted(levels.items())),
        "education": dict(sorted(education.items())),
        "exam_years": dict(sorted(years.items())),
    }, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
