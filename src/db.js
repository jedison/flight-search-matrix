import { SCHEMA_VERSION } from './schema.js';

const DB_NAME = 'flight-search-matrix';
const DB_VERSION = 4;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('results')) {
        const store = db.createObjectStore('results', { keyPath: 'result_id' });
        store.createIndex('run_id', 'run_id'); store.createIndex('sync_status', 'sync_status'); store.createIndex('checked_at', 'checked_at'); store.createIndex('query_key', 'query_key');
      } else {
        const store = request.transaction.objectStore('results');
        if (!store.indexNames.contains('query_key')) store.createIndex('query_key', 'query_key');
      }
      if (!db.objectStoreNames.contains('runs')) db.createObjectStore('runs', { keyPath: 'run_id' });
      if (!db.objectStoreNames.contains('summaries')) {
        const summaries = db.createObjectStore('summaries', { keyPath: 'summary_id' });
        summaries.createIndex('run_id', 'run_id'); summaries.createIndex('query_id', 'query_id'); summaries.createIndex('query_key', 'query_key'); summaries.createIndex('sync_status', 'sync_status'); summaries.createIndex('last_checked_at', 'last_checked_at');
      } else {
        const summaries = request.transaction.objectStore('summaries');
        if (!summaries.indexNames.contains('query_key')) summaries.createIndex('query_key', 'query_key');
      }
      if (!db.objectStoreNames.contains('current_best')) db.createObjectStore('current_best', { keyPath: 'query_key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function migrateRow(row) {
  if (!row) return row;
  return { schema_version: row.schema_version || 2, ...row };
}

async function put(storeName, row) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite'); tx.objectStore(storeName).put(row);
    tx.oncomplete = () => { db.close(); resolve(row); }; tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getAll(storeName, sortKey, limit = 5000) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly'); const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result.map(migrateRow).sort((a,b)=>String(b[sortKey]||'').localeCompare(String(a[sortKey]||''))).slice(0,limit));
    request.onerror = () => reject(request.error); tx.oncomplete = () => db.close();
  });
}

async function getByIndex(storeName, indexName, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly'); const request = tx.objectStore(storeName).index(indexName).getAll(value);
    request.onsuccess = () => resolve(request.result.map(migrateRow)); request.onerror = () => reject(request.error); tx.oncomplete = () => db.close();
  });
}

async function updateSyncRows(storeName, ids, status, errorMessage = '') {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite'); const store = tx.objectStore(storeName);
    for (const id of ids) { const request = store.get(id); request.onsuccess = () => { if (request.result) store.put({ ...request.result, sync_status:status, sync_error:errorMessage }); }; }
    tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function currentBestFromSummary(summary) {
  return {
    schema_version: SCHEMA_VERSION, query_key: summary.query_key, summary_id: summary.summary_id, run_id: summary.run_id, adapter: summary.adapter,
    origin: summary.origin, destination: summary.destination, outbound_date: summary.outbound_date, return_origin: summary.return_origin || '', return_destination: summary.return_destination || '', return_date: summary.return_date || '', trip_type: summary.trip_type, cabin_requested: summary.cabin_requested,
    final_status: summary.final_status, best_mileage_price: summary.best_mileage_price, best_cash_price: summary.best_cash_price, currency: summary.currency, best_fees: summary.best_fees, fees_currency: summary.fees_currency, cash_price_basis: summary.cash_price_basis || '', last_checked_at: summary.last_checked_at
  };
}

async function shouldReplaceCurrent(summary) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('current_best', 'readonly'); const req = tx.objectStore('current_best').get(summary.query_key);
    req.onsuccess = () => {
      const existing = req.result;
      if (!existing) return resolve(true);
      if (summary.final_status === 'AVAILABLE' && existing.final_status !== 'AVAILABLE') return resolve(true);
      if (summary.final_status !== 'AVAILABLE' && existing.final_status === 'AVAILABLE') return resolve(false);
      const smPresent=summary.best_mileage_price!==''&&summary.best_mileage_price!==null&&summary.best_mileage_price!==undefined;
      const emPresent=existing.best_mileage_price!==''&&existing.best_mileage_price!==null&&existing.best_mileage_price!==undefined;
      const sm = Number(summary.best_mileage_price), em = Number(existing.best_mileage_price);
      if (smPresent && Number.isFinite(sm) && (!emPresent || !Number.isFinite(em) || sm < em)) return resolve(true);
      if (smPresent && emPresent && Number.isFinite(sm) && Number.isFinite(em) && sm === em) {
        const sf=Number(summary.best_fees), ef=Number(existing.best_fees);
        const sfPresent=summary.best_fees!==''&&summary.best_fees!==null&&summary.best_fees!==undefined&&Number.isFinite(sf);
        const efPresent=existing.best_fees!==''&&existing.best_fees!==null&&existing.best_fees!==undefined&&Number.isFinite(ef);
        if (sfPresent && (!efPresent || sf < ef)) return resolve(true);
        if (sfPresent !== efPresent) return resolve(sfPresent);
      }
      const scPresent=summary.best_cash_price!==''&&summary.best_cash_price!==null&&summary.best_cash_price!==undefined;
      const ecPresent=existing.best_cash_price!==''&&existing.best_cash_price!==null&&existing.best_cash_price!==undefined;
      const sc = Number(summary.best_cash_price), ec = Number(existing.best_cash_price);
      if (scPresent && Number.isFinite(sc) && (!ecPresent || !Number.isFinite(ec) || sc < ec)) return resolve(true);
      resolve(String(summary.last_checked_at || '') >= String(existing.last_checked_at || ''));
    };
    req.onerror = () => reject(req.error); tx.oncomplete = () => db.close();
  });
}

export const saveResult = row => put('results', row);
export const saveRun = row => put('runs', { schema_version:SCHEMA_VERSION, ...row });
export async function saveSummary(row) { await put('summaries', row); if (await shouldReplaceCurrent(row)) await put('current_best', currentBestFromSummary(row)); return row; }
export const getResults = (limit=5000) => getAll('results','checked_at',limit);
export const getSummaries = (limit=5000) => getAll('summaries','last_checked_at',limit);
export const getRuns = (limit=1000) => getAll('runs','started_at',limit);
export const getCurrentBest = (limit=5000) => getAll('current_best','last_checked_at',limit);
export const getResultsForQuery = queryKey => getByIndex('results','query_key',queryKey);
export async function getUnsyncedResults(limit=250) { return (await getResults(10000)).filter(r=>r.sync_status!=='SYNCED').slice(0,limit); }
export async function getUnsyncedSummaries(limit=250) { return (await getSummaries(10000)).filter(r=>r.sync_status!=='SYNCED').slice(0,limit); }
export const markSynced = ids => updateSyncRows('results',ids,'SYNCED');
export const markSyncError = (ids,error) => updateSyncRows('results',ids,'ERROR',error);
export const markSummariesSynced = ids => updateSyncRows('summaries',ids,'SYNCED');
export const markSummariesSyncError = (ids,error) => updateSyncRows('summaries',ids,'ERROR',error);
