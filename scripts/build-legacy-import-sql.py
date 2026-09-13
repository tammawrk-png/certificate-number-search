#!/usr/bin/env python3
"""Build a reviewed, idempotent SQL import from a Firebase JSON snapshot.

The output contains historical PII and must stay outside the repository. It
never contacts or modifies Firebase; the caller must review it before running
it in an authenticated Supabase SQL Editor.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path


def load_transformer():
    path = Path(__file__).with_name("build-legacy-import.py")
    spec = importlib.util.spec_from_file_location("legacy_transformer", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module


def sql_literal(payload: str) -> str:
    return "$legacy$" + payload.replace("$legacy$", "$legacy_dollar$") + "$legacy$"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    payload = json.loads(args.snapshot.read_text(encoding="utf-8"))
    records = payload.get("certificates", payload)
    if not isinstance(records, dict):
        raise SystemExit("expected an object under certificates")

    transformer = load_transformer()
    rows = transformer.transform_records(records)
    invalid = {
        "empty_names": sum(not row["normalized_name"] for row in rows),
        "empty_certificate_numbers": sum(not row["certificate_no"] for row in rows),
        "unknown_levels": sum(not row["level"] for row in rows),
    }
    if any(invalid.values()):
        raise SystemExit(json.dumps({"error": "legacy snapshot failed import validation", **invalid}, ensure_ascii=False))

    payload_json = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
    sql = f"""begin;
create temp table legacy_import_rows on commit drop as
select * from jsonb_to_recordset({sql_literal(payload_json)}::jsonb) as x(
  firebase_key text, certificate_no text, first_name text, last_name text,
  full_name text, normalized_name text, education_band text, level text,
  exam_year_be text, source_database text, source_payload jsonb
);
insert into legacy_certificates (
  firebase_key, certificate_no, first_name, last_name, full_name,
  normalized_name, education_band, level, exam_year_be, source_database,
  source_payload, imported_at
)
select firebase_key, certificate_no, first_name, last_name, full_name,
  normalized_name, education_band, level, exam_year_be, source_database,
  source_payload, now()
from legacy_import_rows
on conflict (firebase_key) do update set
  certificate_no = excluded.certificate_no,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  full_name = excluded.full_name,
  normalized_name = excluded.normalized_name,
  education_band = excluded.education_band,
  level = excluded.level,
  exam_year_be = excluded.exam_year_be,
  source_database = excluded.source_database,
  source_payload = excluded.source_payload,
  imported_at = now();
insert into import_batches(source_type, source_name, source_version, row_count)
select 'firebase', 'Firebase Realtime Database certificates', 'live-readonly-audit', count(*)
from legacy_import_rows;
select count(*) as imported_rows from legacy_import_rows;
commit;"""
    args.output.write_text(sql, encoding="utf-8")
    print(json.dumps({"output": str(args.output), "rows": len(rows), **invalid}, ensure_ascii=False))


if __name__ == "__main__":
    main()
