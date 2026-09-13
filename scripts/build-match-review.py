#!/usr/bin/env python3
"""Build a reviewable current-roster to legacy-certificate match file.

This tool is deliberately read-only with respect to Firebase and Supabase. It
creates a local CSV in a caller-supplied path; the output contains PII and
must stay outside the repository until an authenticated import is performed.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path


THAI_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")


def normalize_name(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).lower().translate(THAI_DIGITS)
    return re.sub(r"[\s\-_/\.()]+", "", text)


def display_name(row: dict[str, str]) -> str:
    full = str(row.get("full_name") or row.get("fullName") or "").strip()
    if full:
        return full
    return " ".join(part for part in (row.get("first_name"), row.get("last_name")) if part).strip()


def load_legacy(path: Path) -> dict[str, list[dict[str, str]]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    certificates = payload.get("certificates", payload)
    if not isinstance(certificates, dict):
        raise ValueError("expected an object under certificates")
    index: dict[str, list[dict[str, str]]] = defaultdict(list)
    for firebase_key, raw in certificates.items():
        if not isinstance(raw, dict):
            continue
        record = {
            "firebase_key": str(firebase_key),
            "certificate_no": str(raw.get("certificateNo") or ""),
            "full_name": str(raw.get("fullName") or "").strip(),
            "first_name": str(raw.get("firstName") or "").strip(),
            "last_name": str(raw.get("lastName") or "").strip(),
            "level": str(raw.get("level") or "").strip(),
            "exam_year_be": str(raw.get("examYear") or "").strip(),
        }
        key = normalize_name(record["full_name"] or record["first_name"] + record["last_name"])
        if key:
            index[key].append(record)
    return index


def load_roster(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as stream:
        return list(csv.DictReader(stream))


def build_matches(roster: list[dict[str, str]], legacy: dict[str, list[dict[str, str]]]) -> list[dict[str, str]]:
    output: list[dict[str, str]] = []
    for student in roster:
        current_name = display_name(student)
        candidates = legacy.get(normalize_name(current_name), [])
        if len(candidates) == 1:
            status, confidence, basis = "auto_matched", "1.0000", "exact_normalized_full_name"
        elif candidates:
            status, confidence, basis = "review", "0.7500", "exact_name_multiple_legacy_records"
        else:
            status, confidence, basis = "unmatched", "0.0000", "no_exact_normalized_name"
        # Keep one output row per candidate so a reviewer can distinguish
        # ambiguous records; unmatched students still get one audit row.
        rows = candidates or [{}]
        for candidate in rows:
            output.append({
                "student_number": str(student.get("student_number") or ""),
                "current_full_name": current_name,
                "grade_level": str(student.get("grade_level") or ""),
                "room_no": str(student.get("room_no") or ""),
                "legacy_firebase_key": candidate.get("firebase_key", ""),
                "certificate_no": candidate.get("certificate_no", ""),
                "legacy_full_name": candidate.get("full_name", ""),
                "level": candidate.get("level", ""),
                "exam_year_be": candidate.get("exam_year_be", ""),
                "status": status,
                "confidence": confidence,
                "matching_basis": basis,
            })
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("legacy_json", type=Path)
    parser.add_argument("roster_csv", type=Path)
    parser.add_argument("output_csv", type=Path)
    args = parser.parse_args()

    legacy = load_legacy(args.legacy_json)
    matches = build_matches(load_roster(args.roster_csv), legacy)
    fields = list(matches[0]) if matches else [
        "student_number", "current_full_name", "grade_level", "room_no",
        "legacy_firebase_key", "certificate_no", "legacy_full_name", "level",
        "exam_year_be", "status", "confidence", "matching_basis",
    ]
    with args.output_csv.open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(matches)
    counts = defaultdict(int)
    for row in matches:
        counts[row["status"]] += 1
    print(json.dumps({"output": str(args.output_csv), "legacy_name_keys": len(legacy), "rows": len(matches), "status_counts": dict(counts)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
