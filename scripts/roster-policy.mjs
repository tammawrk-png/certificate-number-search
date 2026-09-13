/**
 * Pure import boundary for 2569 roster rows.
 * The spreadsheet extractor calls this before any database write.
 */
export const ACTIVE_ROOM_LIMIT = Object.freeze({
  lower_secondary: 15,
  upper_secondary: 12,
});

export function educationBandForGrade(gradeLevel) {
  const grade = Number(gradeLevel);
  if (grade >= 1 && grade <= 3) return 'lower_secondary';
  if (grade >= 4 && grade <= 6) return 'upper_secondary';
  return null;
}

export function isImportableRosterRow(row) {
  if (!row || String(row.status || 'active').toLowerCase() === 'left') return false;
  const band = row.educationBand || educationBandForGrade(row.gradeLevel);
  const room = Number(row.roomNo);
  return Boolean(band && Number.isInteger(room) && room >= 1 && room <= ACTIVE_ROOM_LIMIT[band]);
}

export function filterImportableRosterRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter(isImportableRosterRow);
}
