#!/usr/bin/env python3
"""Audit current-school XLSX rosters without printing student PII.

This is intentionally an audit-only reader. It writes no database records and
does not copy source workbooks into the repository.
"""
from __future__ import annotations

import argparse
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
THAI_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")


def text_value(node: ET.Element | None) -> str:
    if node is None:
        return ""
    return "".join((part.text or "") for part in node.iter(f"{{{NS}}}t"))


def column_number(ref: str) -> int:
    letters = re.match(r"[A-Z]+", ref.upper())
    if not letters:
        return 0
    value = 0
    for char in letters.group(0):
        value = value * 26 + ord(char) - 64
    return value


def clean_scalar(value: str) -> str:
    """Normalize Excel's integer-as-decimal representation without rounding."""
    match = re.fullmatch(r"([0-9]+)\.0", value.strip())
    return match.group(1) if match else value.strip()


def workbook_sheets(book: zipfile.ZipFile) -> list[tuple[str, str]]:
    workbook = ET.fromstring(book.read("xl/workbook.xml"))
    rels = ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))
    targets = {
        item.attrib["Id"]: item.attrib["Target"]
        for item in rels.findall(f"{{{PKG_REL}}}Relationship")
    }
    result = []
    for sheet in workbook.find(f"{{{NS}}}sheets") or []:
        rid = sheet.attrib[f"{{{REL}}}id"]
        target = targets[rid].lstrip("/")
        if not target.startswith("xl/"):
            target = "xl/" + target
        result.append((sheet.attrib["name"], target))
    return result


def shared_strings(book: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(book.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    return [text_value(item) for item in root.findall(f"{{{NS}}}si")]


def sheet_rows(book: zipfile.ZipFile, path: str, strings: list[str]) -> list[dict[int, str]]:
    root = ET.fromstring(book.read(path))
    rows = []
    for row in root.findall(f".//{{{NS}}}row"):
        values: dict[int, str] = {}
        for cell in row.findall(f"{{{NS}}}c"):
            ref = cell.attrib.get("r", "")
            col = column_number(ref)
            raw = cell.find(f"{{{NS}}}v")
            value = raw.text if raw is not None and raw.text else ""
            if cell.attrib.get("t") == "s" and value:
                value = strings[int(value)]
            if cell.attrib.get("t") == "inlineStr":
                value = text_value(cell.find(f"{{{NS}}}is"))
            values[col] = clean_scalar(value)
        rows.append(values)
    return rows


def grade_from_filename(path: Path) -> int | None:
    match = re.search(r"ม([1-6])", path.stem)
    return int(match.group(1)) if match else None


def room_limit(grade: int) -> int:
    return 15 if grade <= 3 else 12


def audit_file(path: Path) -> dict:
    grade = grade_from_filename(path)
    if grade is None:
        raise ValueError(f"cannot derive grade from filename: {path.name}")
    rooms = []
    with zipfile.ZipFile(path) as book:
        strings = shared_strings(book)
        for room_no, (sheet_name, sheet_path) in enumerate(workbook_sheets(book), 1):
            rows = sheet_rows(book, sheet_path, strings)
            students = []
            advisor = ""
            if len(rows) >= 3:
                advisor = rows[2].get(2, "")
            for row in rows[4:]:
                number = row.get(1, "")
                student_id = row.get(2, "")
                first_name = row.get(3, "")
                last_name = row.get(4, "")
                if number.isdigit() and student_id and (first_name or last_name):
                    students.append({"student_number": student_id, "first_name": first_name, "last_name": last_name})
            rooms.append({
                "room_no": room_no,
                "sheet_name": sheet_name,
                "advisor_present": bool(advisor),
                "row_count": len(students),
                "importable": room_no <= room_limit(grade),
            })
    importable = [room for room in rooms if room["importable"]]
    return {
        "file": path.name,
        "grade_level": grade,
        "sheet_count": len(rooms),
        "importable_rooms": [room["room_no"] for room in importable if room["row_count"] > 0],
        "excluded_rooms": [room["room_no"] for room in rooms if not room["importable"]],
        "importable_student_rows": sum(room["row_count"] for room in importable),
        "advisors_found": sum(1 for room in importable if room["advisor_present"]),
        "room_counts": {str(room["room_no"]): room["row_count"] for room in rooms},
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    files = sorted(args.directory.glob("ม[1-6]*.xlsx"))
    if len(files) != 6:
        raise SystemExit(f"expected six grade workbooks, found {len(files)}")
    audits = [audit_file(path) for path in files]
    print(json.dumps({
        "source_directory": args.directory.name,
        "files": audits,
        "total_importable_student_rows": sum(item["importable_student_rows"] for item in audits),
        "policy": "exclude room 16 and rooms beyond grade band limit; audit only",
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
