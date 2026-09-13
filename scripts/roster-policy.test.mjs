import assert from 'node:assert/strict';
import { educationBandForGrade, filterImportableRosterRows, isImportableRosterRow } from './roster-policy.mjs';

assert.equal(educationBandForGrade(1), 'lower_secondary');
assert.equal(educationBandForGrade(4), 'upper_secondary');
assert.equal(educationBandForGrade(7), null);
assert.equal(isImportableRosterRow({ gradeLevel: 1, roomNo: 15 }), true);
assert.equal(isImportableRosterRow({ gradeLevel: 1, roomNo: 16 }), false);
assert.equal(isImportableRosterRow({ gradeLevel: 4, roomNo: 12 }), true);
assert.equal(isImportableRosterRow({ gradeLevel: 4, roomNo: 13 }), false);
assert.equal(isImportableRosterRow({ gradeLevel: 2, roomNo: 2, status: 'left' }), false);
assert.equal(isImportableRosterRow({ gradeLevel: 1, roomNo: '15.0' }), true);
assert.equal(filterImportableRosterRows([
  { gradeLevel: 1, roomNo: 1 },
  { gradeLevel: 1, roomNo: 16 },
  { gradeLevel: 4, roomNo: 12 },
  { gradeLevel: 4, roomNo: 13 },
  { gradeLevel: 2, roomNo: 2, status: 'left' },
]).length, 2);

console.log('roster-policy tests passed');
