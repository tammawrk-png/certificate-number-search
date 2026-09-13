---
name: dharma-education-system
description: Develop, integrate, test, deploy, and verify the Wat Rai Khing Dharma education exam system.
---

# Dharma Education System

Use this skill for every continuation of the Wat Rai Khing Wittaya Dharma education project. Read the relevant project references before changing code or data.

## Non-negotiable boundaries

- Work inside this repository through VS Code and keep the legacy certificate-search page working.
- Firebase is the read-only historical source. Never dual-write Firebase and Supabase.
- Supabase/PostgreSQL is the system of record for the new activity, registration, eligibility, seat, result, and audit data.
- Never put a Supabase service-role key, Google credential, or other secret in frontend code, GitHub, Google Drive, or this repository.
- Google Drive reads and writes must use `tammawrk@gmail.com` and only the configured Dharma education folder. Verify the connected profile immediately before a write.
- Preserve the three original `.xls` Mother Sangha forms exactly. Do not overwrite, redesign, merge levels, merge classes, or merge examination fields.
- Do not import or edit room 16 or students who have left. Do not infer that every grade has 16 active rooms.
- Public dashboards may show aggregate counts and operational status, but must not expose raw student records.
- Eligibility, room/seat, and result information is unavailable until an official import exists. Never invent or infer those values.

## Required working loop

1. Read `references/project-rules.md` and the relevant `docs/` files.
2. Inspect `git status`, existing diffs, current branch, and the target files. Preserve unrelated user changes.
3. Make the smallest coherent change with `apply_patch`.
4. Run focused validation: JSON/SQL/JS checks, data counts, API tests, and responsive UI checks as applicable.
5. Build the site and inspect the generated page on desktop and phone-sized viewports.
6. Review the diff and confirm no source form, room-16 data, secrets, or unrelated changes entered the change.
7. Commit and push only the verified change. Run the GitHub Pages deployment and inspect the deployed page and the legacy search flow.
8. If anything fails, fix it and repeat the loop. Do not report success from a build alone.

## Integration order

Build and verify API/schema foundations before the new UI: Supabase migration, CRUD contract, authentication/roles, imports, matching workflow, registration rules, official eligibility import, seats/results, reports, then public and staff views.

When a real Supabase project URL or CLI/API access is missing, state that limitation explicitly and do not claim that the migration or CRUD API was applied remotely.

## References

- Read [project-rules.md](references/project-rules.md) for the detailed data, matching, forms, room, storage, and release rules.
- Read the repository [architecture-and-rollout.md](../../docs/architecture-and-rollout.md) and [api-contract.md](../../docs/api-contract.md) before backend work.
- Read the Supabase migration at `../../supabase/migrations/0001_core_schema.sql` before changing the data model.
