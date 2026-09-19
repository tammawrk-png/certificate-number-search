#!/usr/bin/env python3
"""Synchronize approved activity registrations from Supabase to native Google Sheets.

Supabase remains authoritative. Google credentials are read only from the
workflow environment and never shipped to the browser or committed to source.
"""

from __future__ import annotations

import argparse
import json
import os

import requests
from google.oauth2 import service_account
from googleapiclient.discovery import build


SHEETS = {
    "ตรี": {"id": "1ezTRI6oafyLPKyGMjOJ7azn96mOp2JXgQYJXHwlThgw", "tab": "sor5", "last": "R"},
    "โท": {"id": "1JH4xXdnp5SijlteO_PJ9a24DSqB81_PFZt5C2UuZ_xQ", "tab": "sor6", "last": "U"},
    "เอก": {"id": "1XjLq0spLXgMQE2MVVUv7sLiz_6BBUCrNJ6bkIqm4BLU", "tab": "1", "last": "U"},
}


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing protected workflow value: {name}")
    return value


def api(base: str, key: str, name: str, method: str = "GET", **kwargs):
    response = requests.request(
        method,
        f"{base}/rest/v1/{name}",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        timeout=60,
        **kwargs,
    )
    response.raise_for_status()
    return response.json() if response.content else None


def rows_for_level(base: str, key: str, year: str, level: str) -> list[dict]:
    rows = api(base, key, "rpc/mother_sangha_form_rows_worker_v1", "POST", json={"requested_year": year, "requested_level": level})
    if not isinstance(rows, list):
        raise RuntimeError(f"Supabase did not return rows for {level}")
    return rows


def drive_sheets():
    info = json.loads(required("GOOGLE_SERVICE_ACCOUNT_JSON"))
    credentials = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    return build("sheets", "v4", credentials=credentials, cache_discovery=False)


def value(row: dict, key: str) -> str:
    return "" if row.get(key) is None else str(row.get(key))


def split_name(row: dict) -> tuple[str, str, str]:
    title = value(row, "title")
    return title, value(row, "first_name"), value(row, "last_name")


def sheet_values(rows: list[dict], level: str) -> list[list[str]]:
    values: list[list[str]] = []
    for index, row in enumerate(rows, start=1):
        title, first_name, last_name = split_name(row)
        base = [
            str(index), title, first_name, last_name, value(row, "citizen_id"), value(row, "dhamma_level"),
            value(row, "class_room"), value(row, "birth_date_be"), value(row, "organization_name"),
            value(row, "organization_subdistrict"), value(row, "organization_district"), value(row, "organization_province"),
            value(row, "temple_affiliation"), value(row, "temple_subdistrict"), value(row, "temple_district"),
            value(row, "temple_province"), value(row, "school_council"),
        ]
        if level == "ตรี":
            base.append(value(row, "notes"))
        else:
            base.extend([
                value(row, "previous_certificate_year"), value(row, "previous_certificate_no"),
                value(row, "previous_school_council"), value(row, "notes"),
            ])
        values.append(base)
    return values


def sync_one(sheets, level: str, rows: list[dict]) -> None:
    spec = SHEETS[level]
    sheet = sheets.spreadsheets().values()
    sheet.clear(spreadsheetId=spec["id"], range=f"'{spec['tab']}'!A9:{spec['last']}1059").execute()
    values = sheet_values(rows, level)
    if values:
        sheet.update(
            spreadsheetId=spec["id"],
            range=f"'{spec['tab']}'!A9:{spec['last']}{8 + len(values)}",
            valueInputOption="RAW",
            body={"values": values},
        ).execute()


def set_queue(base: str, key: str, year: str, state: str, error: str | None = None) -> None:
    api(base, key, "rpc/mark_google_sheet_sync", "POST", json={
        "requested_year": year, "requested_state": state, "requested_error": error,
    })


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", default="2569")
    args = parser.parse_args()
    base = required("SUPABASE_URL").rstrip("/")
    key = required("SUPABASE_SERVICE_ROLE_KEY")
    sheets = drive_sheets()
    try:
        all_counts = {}
        for level in SHEETS:
            rows = rows_for_level(base, key, args.year, level)
            sync_one(sheets, level, rows)
            all_counts[level] = len(rows)
        set_queue(base, key, args.year, "complete")
        print(json.dumps({"status": "synced", "year": args.year, "counts": all_counts}, ensure_ascii=False))
        return 0
    except Exception as exc:
        try:
            set_queue(base, key, args.year, "failed", str(exc)[:1000])
        finally:
            raise


if __name__ == "__main__":
    raise SystemExit(main())
