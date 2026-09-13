#!/usr/bin/env python3
"""Build one official Mother Sangha .xls report and upload it to Drive.

All credentials are supplied by the workflow environment.  The script only
downloads a read-only template, asks Supabase for staff report rows, writes a
temporary output, and uploads that output to the explicitly supplied folder.
Temporary files are removed when the process exits; no report is uploaded to
the GitHub Actions artifact store.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import requests
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload


LEVEL_TO_TEMPLATE = {
    "ตรี": "สำหรับนักเรียน-นักศึกษา-ฆราวาส-ศ.๕-ธรรมศึกษาชั้นตรี_2568-v3.xls",
    "โท": "สำหรับนักเรียน-นักศึกษา-ฆราวาส-ศ.๖-ธรรมศึกษาชั้นโท_2568-v3.xls",
    "เอก": "สำหรับนักเรียน-นักศึกษา-ฆราวาส-ศ.๖-ธรรมศึกษาชั้นเอก_2568-v3.xls",
}
DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"ยังไม่ได้ตั้งค่า GitHub Secret/variable: {name}")
    return value


def drive_client():
    raw = required("GOOGLE_SERVICE_ACCOUNT_JSON")
    info = json.loads(raw)
    credentials = service_account.Credentials.from_service_account_info(info, scopes=[DRIVE_SCOPE])
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


def find_template(drive, folder_id: str, name: str) -> dict:
    query = " and ".join([
        f"'{folder_id}' in parents",
        "trashed = false",
        f"name = '{name.replace(chr(39), chr(92) + chr(39))}'",
    ])
    response = drive.files().list(q=query, fields="files(id,name,mimeType,size,parents)", pageSize=10).execute()
    files = response.get("files", [])
    if len(files) != 1:
        raise RuntimeError(f"ต้องพบต้นฉบับชื่อ {name!r} ในโฟลเดอร์ที่กำหนดเพียง 1 ไฟล์ แต่พบ {len(files)} ไฟล์")
    return files[0]


def download_file(drive, file_id: str, path: Path) -> None:
    request = drive.files().get_media(fileId=file_id)
    with path.open("wb") as handle:
        downloader = MediaIoBaseDownload(handle, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()


def fetch_rows(year: str, level: str) -> list[dict]:
    base = required("SUPABASE_URL").rstrip("/")
    key = required("SUPABASE_SERVICE_ROLE_KEY")
    response = requests.post(
        f"{base}/rest/v1/rpc/mother_sangha_form_rows_v3",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"requested_year": year, "requested_level": level},
        timeout=60,
    )
    response.raise_for_status()
    rows = response.json()
    if not isinstance(rows, list):
        raise RuntimeError("Supabase RPC ไม่คืนค่าเป็นรายการข้อมูล")
    return rows


def upload(drive, path: Path, folder_id: str, name: str) -> dict:
    metadata = {"name": name, "parents": [folder_id], "description": "สร้างจาก Supabase staff report โดย guarded Mother Sangha form worker"}
    media = MediaFileUpload(path, mimetype="application/vnd.ms-excel", resumable=True)
    return drive.files().create(body=metadata, media_body=media, fields="id,name,mimeType,parents,webViewLink").execute()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", required=True)
    parser.add_argument("--level", choices=LEVEL_TO_TEMPLATE, required=True)
    args = parser.parse_args()
    source_folder = required("DRIVE_SOURCE_FOLDER_ID")
    output_folder = required("DRIVE_OUTPUT_FOLDER_ID")
    drive = drive_client()
    template_name = LEVEL_TO_TEMPLATE[args.level]
    template = find_template(drive, source_folder, template_name)
    rows = fetch_rows(args.year, args.level)
    if not rows:
        print(json.dumps({"status": "skipped", "reason": "no_submitted_rows", "level": args.level}, ensure_ascii=False))
        return 0

    root = Path(__file__).resolve().parent
    worker = root / "fill-mother-sangha-form.py"
    with tempfile.TemporaryDirectory(prefix="dharma-report-") as temp:
        work = Path(temp)
        template_path = work / template_name
        rows_path = work / "rows.json"
        output_path = work / f"แม่กองธรรม-{args.year}-{args.level}.xls"
        download_file(drive, template["id"], template_path)
        rows_path.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
        env = {**os.environ, "PYTHONUNBUFFERED": "1"}
        subprocess.run([sys.executable, str(worker), str(template_path), str(rows_path), str(output_path), "--year", args.year, "--level", args.level], check=True, env=env)
        result = upload(drive, output_path, output_folder, output_path.name)
    print(json.dumps({"status": "uploaded", "level": args.level, "rows": len(rows), "drive": result}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
