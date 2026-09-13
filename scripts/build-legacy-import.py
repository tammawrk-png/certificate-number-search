#!/usr/bin/env python3
"""Transform a Firebase certificate snapshot into a Supabase import CSV.

The output is PII and must be written outside the repository. This script does
not contact or modify Firebase, Supabase, or the public website.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from pathlib import Path


THAI_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")


def normalize_name(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).lower().translate(THAI_DIGITS)
    return re.sub(r"[\s\-_/\.()]+", "", text)


def level(value: object) -> str:
    text = str(value or "")
    for candidate in ("ตรี", "โท", "เอก"):
        if candidate in text:
            return candidate
    return ""


def education_band(value: object) -> str:
    text = str(value or "")
    return "higher_education" if "อุดม" in text or "มหาวิทยาลัย" in text else "secondary"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("output_csv", type=Path)
    args = parser.parse_args()
    payload = json.loads(args.snapshot.read_text(encoding="utf-8"))
    records = payload.get("certificates", payload)
    if not isinstance(records, dict):
        raise SystemExit("expected an object under certificates")

    rows = []
    for firebase_key, raw in records.items():
        if not isinstance(raw, dict):
            continue
        first = str(raw.get("firstName") or "").strip()
        last = str(raw.get("lastName") or "").strip()
        full = str(raw.get("fullName") or "").strip() or " ".join(part for part in (first, last) if part)
        rows.append({
            "firebase_key": str(firebase_key),
            "certificate_no": str(raw.get("certificateNo") or "").strip(),
            "first_name": first,
            "last_name": last,
            "full_name": full,
            "normalized_name": normalize_name(full),
            "education_band": education_band(raw.get("educationLevel")),
            "level": level(raw.get("level")),
            "exam_year_be": str(raw.get("examYear") or "").strip(),
            "source_database": "firebase",
            "source_payload": json.dumps(raw, ensure_ascii=False, separators=(",", ":")),
        })

    fields = ["firebase_key", "certificate_no", "first_name", "last_name", "full_name", "normalized_name", "education_band", "level", "exam_year_be", "source_database", "source_payload"]
    with args.output_csv.open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    unknown_levels = sum(not row["level"] for row in rows)
    print(json.dumps({"output": str(args.output_csv), "rows": len(rows), "unknown_levels": unknown_levels, "empty_names": sum(not row["normalized_name"] for row in rows)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
