#!/usr/bin/env python3
"""Build an ignored local 2569 roster payload for the prototype preview."""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path


def split_advisors(value: str) -> tuple[str, str]:
    cleaned = re.sub(r"^ครูที่ปรึกษาชั้น\s*", "", value or "")
    names = [re.sub(r"\s+", " ", re.sub(r"\([^)]*\)", "", item)).strip() for item in cleaned.split(",")]
    names = [item for item in names if item]
    return (names + ["", ""])[:2]


def suggested_level(grade: int) -> str:
    if grade == 6:
        return "เอก"
    if grade == 5:
        return "โท"
    return "ตรี"


def main() -> None:
    roster_path, match_path, output_path = map(Path, sys.argv[1:])
    matches = {}
    with match_path.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            matches[row["student_number"]] = row

    rows = []
    with roster_path.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            grade = int(row["grade_level"])
            advisor_1, advisor_2 = split_advisors(row.get("advisor_text", ""))
            match = matches.get(row["student_number"], {})
            rows.append({
                "number": row["student_number"],
                "name": row["full_name"],
                "first_name": row["first_name"],
                "last_name": row["last_name"],
                "grade": str(grade),
                "room": row["room_no"],
                "education": "มัธยม",
                "birth_iso": "",
                "citizen": "",
                "previous": match.get("certificate_no", ""),
                "previous_certificate_year": match.get("exam_year_be", ""),
                "legacy_key": match.get("legacy_firebase_key", ""),
                "legacy_level": match.get("level", ""),
                "match_status": match.get("status", "unmatched"),
                "application_level": suggested_level(grade),
                "advisor_1": advisor_1,
                "advisor_2": advisor_2,
                "organization_name": "โรงเรียนวัดไร่ขิงวิทยา",
                "organization_location": "ไร่ขิง / สามพราน / นครปฐม",
                "temple_affiliation": "วัดไร่ขิงพระอารามหลวง",
                "school_council": "คณะจังหวัดนครปฐม",
                "previous_school_council": "",
                "notes": "",
                "special_needs": False,
                "exam_status": "",
            })

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps({"academic_year": "2569", "source": "ระบบธรรมศึกษา_พื้นที่ตรวจสอบ_2569", "rows": rows}, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"rows": len(rows), "rooms": len({(r['grade'], r['room']) for r in rows}), "matched": sum(bool(r['previous']) for r in rows)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
