export const SCHEMA_VERSION = 5;

export function makeLeg({ origin, destination, date, direction, ordinal = 1 }) {
  return { origin, destination, date, direction, ordinal };
}

export function normalizeQuery(query = {}) {
  const legs = Array.isArray(query.legs) && query.legs.length
    ? query.legs.map((leg, index) => makeLeg({ ...leg, ordinal: leg.ordinal || index + 1 }))
    : [makeLeg({ origin: query.origin, destination: query.destination, date: query.outboundDate, direction: 'OUTBOUND', ordinal: 1 })]
      .concat(query.returnDate ? [makeLeg({ origin: query.returnOrigin || query.destination, destination: query.returnDestination || query.origin, date: query.returnDate, direction: 'RETURN', ordinal: 2 })] : []);
  return {
    ...query,
    schemaVersion: SCHEMA_VERSION,
    legs,
    origin: legs[0]?.origin || query.origin || '',
    destination: legs[0]?.destination || query.destination || '',
    outboundDate: legs[0]?.date || query.outboundDate || '',
    returnOrigin: legs[1]?.origin || '',
    returnDestination: legs[1]?.destination || '',
    returnDate: legs[1]?.date || '',
    tripType: query.tripType || (legs.length > 1 ? 'roundtrip' : 'oneway')
  };
}

export function normalizeSegment(segment = {}, index = 0) {
  return {
    segment_index: index,
    origin: segment.origin || '',
    destination: segment.destination || '',
    departure_at: segment.departureAt || segment.departure_at || '',
    arrival_at: segment.arrivalAt || segment.arrival_at || '',
    marketing_carrier: segment.marketingCarrier || segment.marketing_carrier || '',
    operating_carrier: segment.operatingCarrier || segment.operating_carrier || '',
    flight_number: segment.flightNumber || segment.flight_number || '',
    cabin: segment.cabin || '',
    duration_minutes: Number.isFinite(Number(segment.durationMinutes ?? segment.duration_minutes)) ? Number(segment.durationMinutes ?? segment.duration_minutes) : '',
    aircraft: segment.aircraft || ''
  };
}

export function normalizeItinerary(parsed = {}) {
  const segments = (parsed.segments || []).map(normalizeSegment);
  const connectionAirports = parsed.connectionAirports || segments.slice(0, -1).map(s => s.destination).filter(Boolean);
  return {
    itinerary_id: parsed.itineraryId || '',
    segments,
    connection_airports: [...new Set(connectionAirports)],
    connection_count: parsed.connections ?? (segments.length ? Math.max(0, segments.length - 1) : ''),
    duration_minutes: Number.isFinite(Number(parsed.durationMinutes)) ? Number(parsed.durationMinutes) : '',
    mixed_cabin: Boolean(parsed.mixedCabin),
    lowest_cabin: parsed.lowestCabin || '',
    requested_cabin_share: Number.isFinite(Number(parsed.requestedCabinShare)) ? Number(parsed.requestedCabinShare) : '',
    price_scope: parsed.priceScope || 'UNKNOWN',
    mileage_scope: parsed.mileageScope || parsed.priceScope || 'UNKNOWN',
    fees_scope: parsed.feesScope || parsed.priceScope || 'UNKNOWN',
    fees_included: parsed.feesIncluded === true,
    price_kind: parsed.priceKind || 'UNKNOWN',
    price_comparable: parsed.priceComparable === true
  };
}
