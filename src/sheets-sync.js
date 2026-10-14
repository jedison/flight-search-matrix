import { RESULT_COLUMNS, SUMMARY_COLUMNS, RUN_COLUMNS, CURRENT_BEST_COLUMNS } from './constants.js';

export function normalizeRow(row, columns) {
  return columns.map(key => {
    const value = row[key];
    if (Array.isArray(value)) return value.join(' | ');
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  });
}
export const normalizeForSheet = result => normalizeRow(result, RESULT_COLUMNS);
export const normalizeSummaryForSheet = summary => normalizeRow(summary, SUMMARY_COLUMNS);
export const normalizeRunForSheet = run => normalizeRow(run, RUN_COLUMNS);
export const normalizeCurrentBestForSheet = row => normalizeRow(row, CURRENT_BEST_COLUMNS);

async function post(url, payload) {
  if (!url) throw new Error('Google Sheets Web App URL is not configured.');
  const response = await fetch(url, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(payload), redirect:'follow' });
  const text = await response.text();
  if (!response.ok) throw new Error(`Sheets sync HTTP ${response.status}: ${text.slice(0,300)}`);
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = { ok:true, raw:text }; }
  if (parsed.ok === false) throw new Error(parsed.error || 'Google Sheets sync rejected the request.');
  return parsed;
}

export async function syncResultsToSheets({url,token,results}) { if (!results.length) return {ok:true,appended:0}; return post(url,{action:'appendResults',token,columns:RESULT_COLUMNS,rows:results.map(normalizeForSheet)}); }
export async function syncSummariesToSheets({url,token,summaries}) { if (!summaries.length) return {ok:true,appended:0}; return post(url,{action:'appendSummaries',token,columns:SUMMARY_COLUMNS,rows:summaries.map(normalizeSummaryForSheet)}); }
export async function syncRunsToSheets({url,token,runs}) { if (!runs.length) return {ok:true,upserted:0}; return post(url,{action:'upsertRuns',token,columns:RUN_COLUMNS,rows:runs.map(normalizeRunForSheet)}); }
export async function syncCurrentBestToSheets({url,token,rows}) { if (!rows.length) return {ok:true,replaced:0}; return post(url,{action:'replaceCurrentBest',token,columns:CURRENT_BEST_COLUMNS,rows:rows.map(normalizeCurrentBestForSheet)}); }

