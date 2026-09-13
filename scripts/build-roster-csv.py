#!/usr/bin/env python3
"""Build temporary CSVs for authenticated Supabase Table Editor import.

Outputs contain student PII and must remain outside Git. IDs are deterministic
so repeated imports can be reconciled safely before any exam registration.
"""
from __future__ import annotations

import argparse
import csv
import re
import uuid
from pathlib import Path

import importlib.util


def load_builder():
    path = Path(__file__).with_name("build-roster-import.py")
    spec = importlib.util.spec_from_file_location("roster_builder", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module


NAMESPACE = uuid.UUID("9c19f8c8-9b1f-4d9a-8cf3-8c18b4fca269")


def deterministic_id(kind: str, value: str) -> str:
    return str(uuid.uuid5(NAMESPACE, f"{kind}:{value}"))


def advisor_names(value: str) -> list[str]:
    cleaned = re.sub(r"^ครูที่ปรึกษาชั้น\s*", "", value or "")
    cleaned = re.sub(r"\([^)]*\)", "", cleaned)
    return [item.strip() for item in cleaned.split(",") if item.strip()]


def write_csv(path: Path, headers: list[str], rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    rows = load_builder().read_rows(args.directory)
    if len(rows) != len({row["student_number"] for row in rows}):
        raise SystemExit("duplicate student numbers found; CSV build stopped")

    year_id = deterministic_id("academic-year", "2569")
    teacher_map: dict[str, str] = {}
    classroom_map: dict[tuple[str, int, int], dict] = {}
    for row in rows:
        names = advisor_names(row["advisor_text"])
        for name in names:
            teacher_map.setdefault(name, deterministic_id("teacher", name))
        key = (row["education_band"], row["grade_level"], row["room_no"])
        if key not in classroom_map:
            classroom_map[key] = {
                "id": deterministic_id("classroom", ":".join(map(str, key))),
                "academic_year_id": year_id,
                "education_band": row["education_band"],
                "grade_level": row["grade_level"],
                "room_no": row["room_no"],
                "advisor_1_id": teacher_map.get(names[0]) if names else "",
                "advisor_2_id": teacher_map.get(names[1]) if len(names) > 1 else "",
                "source_file_name": row["source_file_name"],
                "source_sheet_name": row["source_sheet_name"],
                "active": "true",
            }

    write_csv(args.output / "academic_years.csv", ["id", "year_be", "is_current"], [{"id": year_id, "year_be": "2569", "is_current": "true"}])
    write_csv(args.output / "teachers.csv", ["id", "display_name", "normalized_name", "active"], [
        {"id": teacher_id, "display_name": name, "normalized_name": name, "active": "true"}
        for name, teacher_id in sorted(teacher_map.items())
    ])
    write_csv(args.output / "classrooms.csv", list(next(iter(classroom_map.values())).keys()), list(classroom_map.values()))
    student_rows = []
    for row in rows:
        key = (row["education_band"], row["grade_level"], row["room_no"])
        student_rows.append({
            "id": deterministic_id("student", row["student_number"]),
            "student_number": row["student_number"],
            "first_name": row["first_name"],
            "last_name": row["last_name"],
            "full_name": f"{row['first_name']} {row['last_name']}".strip(),
            "normalized_name": f"{row['first_name']}{row['last_name']}".replace(" ", ""),
            "classroom_id": classroom_map[key]["id"],
            "status": "active",
            "source_file_name": row["source_file_name"],
        })
    write_csv(args.output / "students.csv", list(student_rows[0].keys()), student_rows)
    staging_rows = []
    for row in rows:
        staging_rows.append({
            "academic_year": "2569",
            "student_number": row["student_number"],
            "first_name": row["first_name"],
            "last_name": row["last_name"],
            "full_name": f"{row['first_name']} {row['last_name']}".strip(),
            "grade_level": row["grade_level"],
            "education_band": row["education_band"],
            "room_no": row["room_no"],
            "advisor_text": row["advisor_text"],
            "source_file_name": row["source_file_name"],
            "source_sheet_name": row["source_sheet_name"],
        })
    write_csv(args.output / "roster_staging.csv", list(staging_rows[0].keys()), staging_rows)
    print({"academic_years": 1, "teachers": len(teacher_map), "classrooms": len(classroom_map), "students": len(student_rows), "output": str(args.output)})


if __name__ == "__main__":
    main()
