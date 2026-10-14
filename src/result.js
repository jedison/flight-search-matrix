import { BUILTIN_ADAPTERS } from './adapter-contract.js';
import { assessItinerary } from './constraints.js';
import { normalizeItinerary, normalizeQuery, SCHEMA_VERSION } from './schema.js';
import { queryKey } from './query-summary.js';
import { comparableCashTotal } from './price.js';

function confidenceFor(parsed, itinerary) {
  if (parsed.confidence) return parsed.confidence;
  if (parsed.status === 'AVAILABLE' && (parsed.flightNumbers?.length || itinerary.segments.length)) return 'CONFIRMED';
  if (parsed.status === 'AVAILABLE') return 'LIKELY';
  if (parsed.status === 'NO_RESULT' || parsed.status === 'NO_RESULT_REPEATED') return 'LIKELY';
  return 'INCONCLUSIVE';
}

export function makeObservation({ runId, query, attempt, parsed, sourceUrl }) {
  const now = new Date().toISOString();
  const q = normalizeQuery(query);
  const itinerary = normalizeItinerary(parsed);
  const assessment = assessItinerary(itinerary, q.constraints || {});
  const adapterDescriptor = BUILTIN_ADAPTERS[q.adapter] || {};
  const flightNumbers = parsed.flightNumbers?.length ? parsed.flightNumbers : itinerary.segments.map(s => s.flight_number).filter(Boolean);
  const departureTime = parsed.departureTime || '';
  const arrivalTime = parsed.arrivalTime || '';
  const observedCabin = parsed.observedCabin || parsed.cabin || '';
  const itineraryKey = parsed.itineraryKey || [q.origin,q.destination,q.outboundDate,departureTime,arrivalTime,parsed.connections ?? itinerary.connection_count,parsed.operatingCarrier || '',observedCabin].map(value=>String(value||'').trim().toUpperCase()).join('|');
  return {
    schema_version: SCHEMA_VERSION,
    result_id: crypto.randomUUID(),
    query_id: q.queryId || '',
    query_key: queryKey(q),
    run_id: runId,
    adapter: q.adapter,
    parser_version: parsed.parserVersion || adapterDescriptor.parserVersion || '',
    origin: q.origin,
    destination: q.destination,
    outbound_date: q.outboundDate,
    return_origin: q.returnOrigin || '',
    return_destination: q.returnDestination || '',
    return_date: q.returnDate || '',
    trip_type: q.tripType,
    adults: q.adults,
    cabin_requested: q.cabin,
    status: parsed.status || 'INCONCLUSIVE',
    confidence: confidenceFor(parsed, itinerary),
    status_detail: parsed.statusDetail || '',
    mileage_price: parsed.mileagePrice ?? '',
    mileage_scope: itinerary.mileage_scope,
    cash_price: parsed.cashPrice ?? '',
    cash_total_per_person: comparableCashTotal(parsed, q.adults),
    currency: parsed.currency || '',
    price_scope: itinerary.price_scope,
    price_kind: itinerary.price_kind,
    price_comparable: itinerary.price_comparable,
    fees: parsed.fees ?? '',
    fees_currency: parsed.feesCurrency || parsed.currency || '',
    fees_scope: itinerary.fees_scope,
    fees_included: itinerary.fees_included,
    itinerary_key: itineraryKey,
    itinerary_stage: parsed.itineraryStage || '',
    departure_time: departureTime,
    arrival_time: arrivalTime,
    observed_cabin: observedCabin,
    operating_carrier: parsed.operatingCarrier || [...new Set(itinerary.segments.map(s => s.operating_carrier).filter(Boolean))].join(' | '),
    marketing_carrier: parsed.marketingCarrier || [...new Set(itinerary.segments.map(s => s.marketing_carrier).filter(Boolean))].join(' | '),
    flight_numbers: flightNumbers,
    connections: parsed.connections ?? itinerary.connection_count,
    connection_airports: itinerary.connection_airports,
    duration_minutes: parsed.durationMinutes ?? itinerary.duration_minutes,
    mixed_cabin: itinerary.mixed_cabin,
    lowest_cabin: itinerary.lowest_cabin,
    requested_cabin_share: itinerary.requested_cabin_share,
    seats: parsed.seats ?? '',
    constraint_passes: assessment.passes,
    constraint_reasons: assessment.reasons,
    segments_json: itinerary.segments,
    source_url: sourceUrl || '',
    found_at: parsed.status === 'AVAILABLE' ? now : '',
    checked_at: now,
    attempt,
    raw_excerpt: String(parsed.rawExcerpt || '').slice(0, 1800),
    sync_status: 'PENDING',
    sync_error: ''
  };
}
