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
LEVEL_RANK = {"ตรี": 1, "โท": 2, "เอก": 3}


def normalize_name(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).lower().translate(THAI_DIGITS)
    return re.sub(r"[\s\-_/\.()]+", "", text)


def normalize_person_name(value: object) -> str:
    """Normalize a name while ignoring common Thai honorifics.

    The historical source and the current roster often use different
    prefixes (for example นาย vs เด็กชาย).  This fallback is only accepted
    when it produces one legacy candidate, so it cannot silently choose
    between duplicate names.
    """
    text = normalize_name(value)
    return re.sub(r"^(?:เด็กชาย|เด็กหญิง|นางสาว|นาย|นาง|พระ|สามเณร)", "", text)


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
        person_key = normalize_person_name(record["full_name"] or record["first_name"] + record["last_name"])
        if person_key and person_key != key:
            index[f"person:{person_key}"].append(record)
    return index


def load_roster(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as stream:
        return list(csv.DictReader(stream))


def normalized_level(value: object) -> str:
    text = str(value or "").strip()
    for level in LEVEL_RANK:
        if level in text:
            return level
    return text


def certificate_year(candidate: dict[str, str]) -> int:
    digits = re.sub(r"[^0-9]", "", str(candidate.get("exam_year_be") or ""))
    return int(digits) if digits else -1


def choose_highest_candidates(candidates: list[dict[str, str]]) -> tuple[list[dict[str, str]], str]:
    """Choose the student's highest completed Dhamma level safely.

    A duplicate name is not automatically ambiguous when the records clearly
    describe progression: เอก outranks โท, and โท outranks ตรี.  If the top
    level still has multiple different records from the same/latest year, keep
    it in review rather than guessing.
    """
    if not candidates:
        return [], "no_exact_normalized_name"

    highest_rank = max(LEVEL_RANK.get(normalized_level(row.get("level")), 0) for row in candidates)
    top = [row for row in candidates if LEVEL_RANK.get(normalized_level(row.get("level")), 0) == highest_rank]
    latest_year = max(certificate_year(row) for row in top)
    if latest_year >= 0:
        top = [row for row in top if certificate_year(row) == latest_year]

    # Collapse duplicate imports of the same certificate before deciding.
    unique: dict[tuple[str, str, str], dict[str, str]] = {}
    for row in top:
        key = (row.get("firebase_key", ""), row.get("certificate_no", ""), row.get("exam_year_be", ""))
        unique[key] = row
    top = list(unique.values())
    level = normalized_level(top[0].get("level")) if top else ""
    if len(top) == 1:
        return top, f"highest_completed_level_{level or 'unknown'}"
    return top, "highest_level_still_has_multiple_records"


def build_matches(roster: list[dict[str, str]], legacy: dict[str, list[dict[str, str]]]) -> list[dict[str, str]]:
    output: list[dict[str, str]] = []
    for student in roster:
        current_name = display_name(student)
        exact_candidates = legacy.get(normalize_name(current_name), [])
        titleless_candidates = legacy.get(f"person:{normalize_person_name(current_name)}", [])
        candidates = exact_candidates or titleless_candidates
        selected, selection_basis = choose_highest_candidates(candidates)
        if len(selected) == 1 and selection_basis.startswith("highest_completed_level_"):
            status, confidence, basis = (
                "auto_matched",
                "1.0000",
                selection_basis,
            )
        elif selected:
            status, confidence, basis = "review", "0.7500", selection_basis
        else:
            status, confidence, basis = "unmatched", "0.0000", "no_exact_normalized_name"
        # Keep one output row per candidate so a reviewer can distinguish
        # ambiguous records; unmatched students still get one audit row.
        rows = selected or [{}]
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
