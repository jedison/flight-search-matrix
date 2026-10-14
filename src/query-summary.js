import { SCHEMA_VERSION, CONFIDENCE } from './constants.js';
import { normalizeQuery } from './schema.js';

const STATUS_PRIORITY = Object.freeze({ AVAILABLE:5, NEEDS_USER:4, NO_RESULT_REPEATED:3, NO_RESULT:2, FILTERED:2, INCONCLUSIVE:1, ERROR:0 });
const CONFIDENCE_PRIORITY = Object.freeze({ CONFIRMED:4, LIKELY:3, AMBIGUOUS:2, INCONCLUSIVE:1 });
function numeric(values) { return values.map(Number).filter(Number.isFinite); }
function attemptCount(rows) {
  const withAttempt=rows.filter(row=>row.attempt!==''&&row.attempt!==null&&row.attempt!==undefined);
  return withAttempt.length ? new Set(withAttempt.map(row=>row.attempt)).size : rows.length;
}

export function queryKey(query) {
  const q = normalizeQuery(query);
  return [q.adapter, q.legs.map(l => `${l.origin}-${l.destination}:${l.date}`).join('>'), q.tripType, q.adults, q.cabin].join('|');
}

export function summarizeQuery({ runId, query, observations }) {
  const q = normalizeQuery(query);
  const rows = [...(observations || [])];
  const available = rows.filter(row => row.status === 'AVAILABLE');
  const bestAvailable = available.slice().sort((a,b) => {
    const compare=(left,right)=>{
      const leftNumber=Number(left), rightNumber=Number(right);
      const leftPresent=left!=='' && left!==null && left!==undefined && Number.isFinite(leftNumber);
      const rightPresent=right!=='' && right!==null && right!==undefined && Number.isFinite(rightNumber);
      if(leftPresent && rightPresent) return leftNumber-rightNumber;
      return leftPresent ? -1 : rightPresent ? 1 : 0;
    };
    return compare(a.mileage_price,b.mileage_price) || compare(a.fees,b.fees) || compare(a.duration_minutes,b.duration_minutes);
  })[0];
  const finalRow = rows.slice().sort((a,b)=>(STATUS_PRIORITY[b.status]||-1)-(STATUS_PRIORITY[a.status]||-1))[0];
  const confidence = rows.slice().sort((a,b)=>(CONFIDENCE_PRIORITY[b.confidence]||0)-(CONFIDENCE_PRIORITY[a.confidence]||0))[0]?.confidence || CONFIDENCE.INCONCLUSIVE;
  const mileage = numeric(available.map(row => row.mileage_price).filter(value => value !== ''));
  const comparableCashRows = available.filter(row => row.price_comparable === true && row.cash_total_per_person !== '');
  const cash = numeric(comparableCashRows.map(row => row.cash_total_per_person));
  const fees = numeric(available.map(row => row.fees).filter(value => value !== ''));
  const durations = numeric(available.map(row => row.duration_minutes).filter(value => value !== ''));
  const currencies = [...new Set(available.map(row => row.currency).filter(Boolean))];
  const feeCurrencies = [...new Set(available.map(row => row.fees_currency).filter(Boolean))];
  const flightNumbers = [...new Set(available.flatMap(row => row.flight_numbers || []).filter(Boolean))];
  const connectionAirports = [...new Set(available.flatMap(row => row.connection_airports || []).filter(Boolean))];
  return {
    schema_version: SCHEMA_VERSION,
    summary_id: crypto.randomUUID(), query_id:q.queryId, query_key:queryKey(q), run_id:runId, adapter:q.adapter,
    origin:q.origin, destination:q.destination, outbound_date:q.outboundDate, return_origin:q.returnOrigin || '', return_destination:q.returnDestination || '', return_date:q.returnDate || '', trip_type:q.tripType, adults:q.adults, cabin_requested:q.cabin,
    final_status:available.length?'AVAILABLE':(finalRow?.status||'INCONCLUSIVE'), confidence,
    attempts_recorded:attemptCount(rows), available_attempts:attemptCount(available),
    best_mileage_price:bestAvailable?.mileage_price ?? '', best_cash_price:cash.length?Math.min(...cash):'', currency:currencies.length===1?currencies[0]:'', best_fees:bestAvailable?.fees ?? '', fees_currency:bestAvailable?.fees_currency || (feeCurrencies.length===1?feeCurrencies[0]:''), cash_price_basis:cash.length?'PER_PERSON_TOTAL_INCLUDING_FEES':'',
    flight_numbers:flightNumbers, connection_airports:connectionAirports, minimum_duration_minutes:durations.length?Math.min(...durations):'',
    first_available_at:available.map(row=>row.found_at).filter(Boolean).sort()[0]||'', last_checked_at:rows.map(row=>row.checked_at).filter(Boolean).sort().at(-1)||new Date().toISOString(),
    status_detail:available.length?`${available.length} available offer(s) saved across ${attemptCount(available)} attempt(s).`:(finalRow?.status_detail||'No conclusive result.'), sync_status:'PENDING', sync_error:''
  };
}
