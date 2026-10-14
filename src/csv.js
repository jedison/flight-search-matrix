import { RESULT_COLUMNS } from './constants.js';

function esc(value) {
  const s = Array.isArray(value) ? value.join(' | ') : String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function resultsToCsv(results) {
  return [
    RESULT_COLUMNS.join(','),
    ...results.map(row => RESULT_COLUMNS.map(c => esc(row[c])).join(','))
  ].join('\n');
}

