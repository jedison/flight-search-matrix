export function normalizeConstraints(input = {}) {
  const split = value => [...new Set(String(value || '').split(/[\n,;]+/).map(v => v.trim().toUpperCase()).filter(Boolean))];
  return {
    maxStops: input.maxStops === '' || input.maxStops === undefined ? '' : Math.max(0, Number(input.maxStops) || 0),
    maxLayoverMinutes: input.maxLayoverMinutes === '' || input.maxLayoverMinutes === undefined ? '' : Math.max(0, Number(input.maxLayoverMinutes) || 0),
    allowOvernight: input.allowOvernight !== false,
    allowedConnectionAirports: split(input.allowedConnectionAirports),
    blockedConnectionAirports: split(input.blockedConnectionAirports),
    allowedCarriers: split(input.allowedCarriers),
    blockedCarriers: split(input.blockedCarriers),
    requireRequestedCabin: Boolean(input.requireRequestedCabin)
  };
}

export function assessItinerary(itinerary = {}, constraints = {}) {
  const reasons = [];
  const c = normalizeConstraints(constraints);
  const connections = itinerary.connection_airports || itinerary.connectionAirports || [];
  const segments = itinerary.segments || [];
  const carriers = [...new Set(segments.flatMap(s => [s.operating_carrier || s.operatingCarrier, s.marketing_carrier || s.marketingCarrier]).filter(Boolean).map(v => String(v).toUpperCase()))];
  const stopCount = itinerary.connection_count === '' || itinerary.connection_count === undefined ? Math.max(0, segments.length - 1) : Number(itinerary.connection_count);
  if (c.maxStops !== '' && Number.isFinite(stopCount) && stopCount > c.maxStops) reasons.push(`More than ${c.maxStops} stop(s).`);
  if (c.blockedConnectionAirports.some(a => connections.includes(a))) reasons.push('Uses a blocked connection airport.');
  if (c.allowedConnectionAirports.length && connections.some(a => !c.allowedConnectionAirports.includes(a))) reasons.push('Uses a connection airport outside the allowed list.');
  if (c.blockedCarriers.some(a => carriers.includes(a))) reasons.push('Uses a blocked carrier.');
  if (c.allowedCarriers.length && carriers.some(a => !c.allowedCarriers.includes(a))) reasons.push('Uses a carrier outside the allowed list.');
  if (c.requireRequestedCabin && itinerary.mixed_cabin) reasons.push('Mixed cabin does not satisfy requested-cabin requirement.');
  return { passes: reasons.length === 0, reasons };
}

