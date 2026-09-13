# Project rules and operating method

## Source inventory

- Firebase project: `certificate-number-search-th`, 3,278 historical certificate records, years 2562–2568.
- Local historical snapshot may differ from Firebase. Treat the current Firebase read as authoritative for the import and record the import count.
- Current 2569 roster files are grouped by grade and contain one worksheet per room. The third row contains one or two advisors and sometimes the study program.
- The source workbooks currently contain room sheets through room 16, but room 16 is excluded by project rule. Empty rooms are not active rooms.
- Mother Sangha source forms are `สำหรับนักเรียน-นักศึกษา-ฆราวาส-ศ.๕-ธรรมศึกษาชั้นตรี_2568-v3.xls`, `...ศ.๖-ธรรมศึกษาชั้นโท_2568-v3.xls`, and `...ศ.๖-ธรรมศึกษาชั้นเอก_2568-v3.xls`.

## Identity matching

Match current students to legacy certificates without changing legacy rows. Normalize Thai digits, whitespace, separators, and Unicode before candidate generation. A name-only match is a candidate, not proof. Store match basis, confidence, status, reviewer, and review time. Support `auto_matched`, `review`, `confirmed`, `rejected`, and `unmatched`. Never silently merge duplicate names.

## Education and registration rules

Keep education band and Dharma level as separate dimensions. The current rule is that lower secondary and upper secondary are separate tracks; M.1 and M.4 require an initial Dharma level ตรี registration; continuation to โท/เอก is optional unless the authorized school rule says otherwise. Put year-specific rules in data/configuration rather than hardcoding them in the UI.

## Official data lifecycle

`submitted → verified → official eligibility imported → seat imported → result imported`.

The public lookup must show a clear pending state until the corresponding import exists. Import batches must be idempotent, count rows, retain the source name/version, and be auditable.

## Reports

Produce two distinct report families:

1. Mother Sangha submission files, one level and one examination field per file, using the original workbook structure and field positions.
2. School reports with grade, room, student number, advisor(s), registration state, eligibility, seat, result, and follow-up status.

Do not use the school report as a substitute for the official workbook. Render and compare official outputs against the source template before release.

## Storage roles

- Supabase: transactional source of truth, API, RLS, roles, audit log.
- Firebase: legacy read-only source and migration input.
- Google Sheets: controlled import/review/export surface, never a second live source of truth.
- Google Drive: source forms, generated reports, and organized project artifacts only in the assigned folder.
- GitHub: source, migrations, tests, CI, and encrypted recovery metadata. Do not commit raw student PII or unencrypted backups.

## Release gates

Before push/deploy, verify legacy search, public dashboard aggregates, responsive registration UI, eligibility/seat/result pending states, import idempotency, matching review, official-form layout, and absence of secrets. After deployment, open the actual GitHub Pages URL and repeat the high-value checks in the deployed environment.
