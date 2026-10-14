const CONFIG = {
  RESULTS_SHEET: 'Observations',
  SUMMARIES_SHEET: 'Queries',
  RUNS_SHEET: 'Runs',
  CURRENT_BEST_SHEET: 'Current Best',
  TOKEN_PROPERTY: 'FLIGHT_SEARCH_SYNC_TOKEN'
};

const RESULT_COLUMNS = [
  'schema_version','result_id','query_id','query_key','run_id','adapter','parser_version','origin','destination','outbound_date','return_origin','return_destination','return_date','trip_type','adults','cabin_requested',
  'status','confidence','status_detail','mileage_price','mileage_scope','cash_price','cash_total_per_person','currency','price_scope','price_kind','price_comparable','fees','fees_currency','fees_scope','fees_included','operating_carrier','marketing_carrier',
  'flight_numbers','connections','connection_airports','duration_minutes','mixed_cabin','lowest_cabin','requested_cabin_share','seats','constraint_passes','constraint_reasons','segments_json',
  'source_url','found_at','checked_at','attempt','raw_excerpt','sync_status','sync_error'
];
const SUMMARY_COLUMNS = [
  'schema_version','summary_id','query_id','query_key','run_id','adapter','origin','destination','outbound_date','return_origin','return_destination','return_date','trip_type','adults','cabin_requested',
  'final_status','confidence','attempts_recorded','available_attempts','best_mileage_price','best_cash_price','currency','best_fees','fees_currency','cash_price_basis','flight_numbers','connection_airports','minimum_duration_minutes','first_available_at','last_checked_at','status_detail','sync_status','sync_error'
];
const RUN_COLUMNS = ['schema_version','run_id','started_at','ended_at','status','total_queries','completed_queries','search_definition_json','settings_snapshot_json'];
const CURRENT_BEST_COLUMNS = ['schema_version','query_key','summary_id','run_id','adapter','origin','destination','outbound_date','return_origin','return_destination','return_date','trip_type','cabin_requested','final_status','best_mileage_price','best_cash_price','currency','best_fees','fees_currency','cash_price_basis','last_checked_at'];

function ensureSheet_(ss, name, columns) {
  let sheet = ss.getSheetByName(name); if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1,1,1,columns.length).setValues([columns]);
  } else {
    const oldWidth=Math.max(1,sheet.getLastColumn());
    const oldHeaders=sheet.getRange(1,1,1,oldWidth).getValues()[0].map(String);
    const same=oldHeaders.length===columns.length && columns.every((c,i)=>oldHeaders[i]===c);
    if (!same) {
      const oldRows=sheet.getLastRow()>1 ? sheet.getRange(2,1,sheet.getLastRow()-1,oldWidth).getValues() : [];
      const oldIndex={}; oldHeaders.forEach((h,i)=>{if(h)oldIndex[h]=i;});
      const migrated=oldRows.map(row=>columns.map(c=>oldIndex[c]===undefined?'':row[oldIndex[c]]));
      sheet.clearContents(); sheet.getRange(1,1,1,columns.length).setValues([columns]);
      if(migrated.length) sheet.getRange(2,1,migrated.length,columns.length).setValues(migrated);
    }
  }
  sheet.setFrozenRows(1); sheet.getRange(1,1,1,columns.length).setFontWeight('bold'); sheet.autoResizeColumns(1,Math.min(columns.length,12));
  return sheet;
}

function setupFlightSearchSheet() {
  const ss=SpreadsheetApp.getActive();
  ensureSheet_(ss,CONFIG.RESULTS_SHEET,RESULT_COLUMNS); ensureSheet_(ss,CONFIG.SUMMARIES_SHEET,SUMMARY_COLUMNS); ensureSheet_(ss,CONFIG.RUNS_SHEET,RUN_COLUMNS); ensureSheet_(ss,CONFIG.CURRENT_BEST_SHEET,CURRENT_BEST_COLUMNS);
  return 'Ready';
}
function setFlightSearchSyncToken(token) { if(!token||String(token).length<12) throw new Error('Use a random token of at least 12 characters.'); PropertiesService.getScriptProperties().setProperty(CONFIG.TOKEN_PROPERTY,String(token)); return 'Token stored'; }
function doGet(){return json_({ok:true,service:'Flight Search Matrix Sheets endpoint'});}

function appendUniqueRows_(sheet,columns,rows,idColumnIndex) {
  const existingIds=new Set();
  if(sheet.getLastRow()>1) sheet.getRange(2,idColumnIndex+1,sheet.getLastRow()-1,1).getValues().flat().forEach(id=>id&&existingIds.add(String(id)));
  const uniqueRows=rows.filter(row=>row&&row.length&&!existingIds.has(String(row[idColumnIndex])));
  if(uniqueRows.length) sheet.getRange(sheet.getLastRow()+1,1,uniqueRows.length,columns.length).setValues(uniqueRows.map(row=>columns.map((_,i)=>row[i]===undefined?'':row[i])));
  return uniqueRows.length;
}
function upsertRows_(sheet,columns,rows,idColumnIndex) {
  const existing={};
  if(sheet.getLastRow()>1) sheet.getRange(2,idColumnIndex+1,sheet.getLastRow()-1,1).getValues().flat().forEach((id,i)=>{if(id)existing[String(id)]=i+2;});
  let count=0;
  rows.forEach(row=>{ const id=String(row[idColumnIndex]||''); if(!id)return; const values=[columns.map((_,i)=>row[i]===undefined?'':row[i])]; if(existing[id]) sheet.getRange(existing[id],1,1,columns.length).setValues(values); else {sheet.getRange(sheet.getLastRow()+1,1,1,columns.length).setValues(values); existing[id]=sheet.getLastRow();} count++; });
  return count;
}
function replaceRows_(sheet,columns,rows) {
  if(sheet.getLastRow()>1) sheet.getRange(2,1,sheet.getLastRow()-1,Math.max(sheet.getLastColumn(),columns.length)).clearContent();
  if(rows.length) sheet.getRange(2,1,rows.length,columns.length).setValues(rows.map(row=>columns.map((_,i)=>row[i]===undefined?'':row[i])));
  return rows.length;
}

function doPost(e) {
  try {
    const payload=JSON.parse(e.postData.contents||'{}'); const expected=PropertiesService.getScriptProperties().getProperty(CONFIG.TOKEN_PROPERTY)||'';
    if(expected&&payload.token!==expected)return json_({ok:false,error:'Invalid token'});
    const rows=Array.isArray(payload.rows)?payload.rows:[]; const ss=SpreadsheetApp.getActive(); let sheet,columns,count=0;
    if(payload.action==='appendResults'){columns=RESULT_COLUMNS;sheet=ensureSheet_(ss,CONFIG.RESULTS_SHEET,columns);count=appendUniqueRows_(sheet,columns,rows,1);return json_({ok:true,appended:count,received:rows.length});}
    if(payload.action==='appendSummaries'){columns=SUMMARY_COLUMNS;sheet=ensureSheet_(ss,CONFIG.SUMMARIES_SHEET,columns);count=appendUniqueRows_(sheet,columns,rows,1);return json_({ok:true,appended:count,received:rows.length});}
    if(payload.action==='upsertRuns'){columns=RUN_COLUMNS;sheet=ensureSheet_(ss,CONFIG.RUNS_SHEET,columns);count=upsertRows_(sheet,columns,rows,1);return json_({ok:true,upserted:count});}
    if(payload.action==='replaceCurrentBest'){columns=CURRENT_BEST_COLUMNS;sheet=ensureSheet_(ss,CONFIG.CURRENT_BEST_SHEET,columns);count=replaceRows_(sheet,columns,rows);return json_({ok:true,replaced:count});}
    return json_({ok:false,error:'Unsupported action'});
  } catch(error){return json_({ok:false,error:String(error&&error.stack?error.stack:error)});}
}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
