#!/usr/bin/env python3
"""Build a one-time, idempotent Supabase roster import in a caller-supplied path.

The generated SQL contains student PII. It must stay outside the repository and
must be reviewed before being pasted into the project's authenticated SQL Editor.
"""
from __future__ import annotations

import argparse
import json
import runpy
from pathlib import Path


def read_rows(directory: Path) -> list[dict]:
    audit = runpy.run_path(str(Path(__file__).with_name("audit-roster-xlsx.py")))
    rows: list[dict] = []
    for path in sorted(directory.glob("ม[1-6]*.xlsx")):
        grade = audit["grade_from_filename"](path)
        band = "lower_secondary" if grade <= 3 else "upper_secondary"
        with __import__("zipfile").ZipFile(path) as book:
            strings = audit["shared_strings"](book)
            for room_no, (sheet_name, sheet_path) in enumerate(audit["workbook_sheets"](book), 1):
                if room_no > audit["room_limit"](grade):
                    continue
                sheet_rows = audit["sheet_rows"](book, sheet_path, strings)
                advisor = sheet_rows[2].get(2, "") if len(sheet_rows) >= 3 else ""
                for row in sheet_rows[4:]:
                    number = row.get(1, "")
                    student_id = row.get(2, "")
                    first_name = row.get(3, "")
                    last_name = row.get(4, "")
                    if not number.isdigit() or not student_id or not (first_name or last_name):
                        continue
                    rows.append({
                        "student_number": student_id,
                        "first_name": first_name,
                        "last_name": last_name,
                        "grade_level": grade,
                        "education_band": band,
                        "room_no": room_no,
                        "source_file_name": path.name,
                        "source_sheet_name": sheet_name,
                        "advisor_text": advisor,
                    })
    return rows


def sql_literal(payload: str) -> str:
    return "$roster$" + payload.replace("$roster$", "$roster_dollar$") + "$roster$"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    rows = read_rows(args.directory)
    ids = [row["student_number"] for row in rows]
    if len(ids) != len(set(ids)):
        raise SystemExit("duplicate student numbers found; import stopped")
    payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
    sql = f"""begin;
create temp table roster_import_rows on commit drop as
select * from jsonb_to_recordset({sql_literal(payload)}::jsonb) as x(
  student_number text, first_name text, last_name text, grade_level smallint,
  education_band text, room_no smallint, source_file_name text,
  source_sheet_name text, advisor_text text
);
insert into academic_years(year_be, is_current)
values ('2569', true)
on conflict (year_be) do update set is_current = excluded.is_current;
update academic_years set is_current = (year_be = '2569');
insert into teachers(display_name, normalized_name)
select distinct trim(part), public.dharma_normalize_name(trim(part))
from roster_import_rows,
     regexp_split_to_table(regexp_replace(coalesce(advisor_text, ''), '\\([^)]*\\)', '', 'g'), ',') as part
where trim(part) <> ''
on conflict do nothing;
insert into classrooms(academic_year_id, education_band, grade_level, room_no, advisor_1_id, advisor_2_id, source_file_name, source_sheet_name)
select y.id, r.education_band, r.grade_level, r.room_no,
  t1.id, t2.id, min(r.source_file_name), min(r.source_sheet_name)
from (select distinct education_band, grade_level, room_no, advisor_text, source_file_name, source_sheet_name from roster_import_rows) r
join academic_years y on y.year_be = '2569'
left join lateral (select trim((string_to_array(regexp_replace(coalesce(r.advisor_text, ''), '\\([^)]*\\)', '', 'g'), ','))[1]) as name) a1 on true
left join lateral (select trim((string_to_array(regexp_replace(coalesce(r.advisor_text, ''), '\\([^)]*\\)', '', 'g'), ','))[2]) as name) a2 on true
left join teachers t1 on t1.normalized_name = public.dharma_normalize_name(a1.name)
left join teachers t2 on t2.normalized_name = public.dharma_normalize_name(a2.name)
group by y.id, r.education_band, r.grade_level, r.room_no, t1.id, t2.id
on conflict (academic_year_id, education_band, grade_level, room_no) do update set
  advisor_1_id = excluded.advisor_1_id, advisor_2_id = excluded.advisor_2_id,
  source_file_name = excluded.source_file_name, source_sheet_name = excluded.source_sheet_name;
insert into students(student_number, first_name, last_name, full_name, normalized_name, classroom_id, status, source_file_name)
select r.student_number, r.first_name, r.last_name, trim(r.first_name || ' ' || r.last_name),
  public.dharma_normalize_name(trim(r.first_name || ' ' || r.last_name)), c.id, 'active', r.source_file_name
from roster_import_rows r
join academic_years y on y.year_be = '2569'
join classrooms c on c.academic_year_id = y.id and c.education_band = r.education_band
  and c.grade_level = r.grade_level and c.room_no = r.room_no
on conflict (student_number) do update set
  first_name = excluded.first_name, last_name = excluded.last_name, full_name = excluded.full_name,
  normalized_name = excluded.normalized_name, classroom_id = excluded.classroom_id,
  status = 'active', source_file_name = excluded.source_file_name, updated_at = now();
insert into import_batches(source_type, source_name, source_version, row_count)
select 'student_roster', '2569 current roster workbooks', 'audit-v1', count(*) from roster_import_rows;
select count(*) as imported_rows from roster_import_rows;
commit;"""
    args.output.write_text(sql, encoding="utf-8")
    print(json.dumps({"output": str(args.output), "rows": len(rows), "unique_student_numbers": len(set(ids))}, ensure_ascii=False))


if __name__ == "__main__":
    main()
