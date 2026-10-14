import { expandAirportTokens, parseAirportTokens } from './airport-groups.js';
import { normalizeConstraints } from './constraints.js';
import { normalizeQuery, makeLeg } from './schema.js';

function dateRange(start, end) {
  if (!start || !end) return [];
  const out = [];
  const current = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  if (Number.isNaN(current.valueOf()) || Number.isNaN(last.valueOf()) || current > last) return [];
  while (current <= last) {
    out.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return out;
}

function nightsBetween(a, b) {
  const start = new Date(`${a}T12:00:00Z`);
  const end = new Date(`${b}T12:00:00Z`);
  return Math.round((end - start) / 86400000);
}

function middleDate(start, end) {
  const dates = dateRange(start, end);
  return dates.length ? dates[Math.floor((dates.length - 1) / 2)] : '';
}

function distanceDays(a, b) {
  if (!a || !b) return 0;
  return Math.abs(new Date(`${a}T12:00:00Z`) - new Date(`${b}T12:00:00Z`)) / 86400000;
}

function smartScore(task, input, originOrder, destinationOrder, cabinOrder) {
  let score = 0;
  score += (originOrder.get(task.origin) ?? 99) * 100;
  score += (destinationOrder.get(task.destination) ?? 99) * 50;
  score += (cabinOrder.get(task.cabin) ?? 99) * 25;
  score += distanceDays(task.outboundDate, middleDate(input.outboundStart, input.outboundEnd)) * 5;
  if (task.returnDate) score += distanceDays(task.returnDate, middleDate(input.returnStart, input.returnEnd)) * 2;
  return score;
}

export function buildSearchMatrix(input) {
  const customGroups = input.airportGroups || {};
  const originTokens = parseAirportTokens(input.origins);
  const destinationTokens = parseAirportTokens(input.destinations);
  const origins = expandAirportTokens(input.origins, customGroups);
  const destinations = expandAirportTokens(input.destinations, customGroups);
  const cabins = (input.cabins || []).filter(Boolean);
  const outboundDates = dateRange(input.outboundStart, input.outboundEnd);
  const tripType = input.tripType || 'roundtrip';
  const returnDates = tripType === 'oneway' ? [null] : dateRange(input.returnStart, input.returnEnd);
  const minNights = Number.isFinite(+input.minNights) ? +input.minNights : 0;
  const maxNights = Number.isFinite(+input.maxNights) && +input.maxNights > 0 ? +input.maxNights : Infinity;
  const adults = Math.max(1, Number(input.adults) || 1);
  const adapter = input.adapter || 'miles-and-more';
  const returnOrigins = tripType === 'openjaw' ? expandAirportTokens(input.returnOrigins || input.destinations, customGroups) : [];
  const returnDestinations = tripType === 'openjaw' ? expandAirportTokens(input.returnDestinations || input.origins, customGroups) : [];
  const constraints = normalizeConstraints(input.constraints || input);
  const tasks = [];

  for (const origin of origins) {
    for (const destination of destinations) {
      if (origin === destination) continue;
      for (const outboundDate of outboundDates) {
        for (const returnDate of returnDates) {
          if (returnDate) {
            const nights = nightsBetween(outboundDate, returnDate);
            if (nights < minNights || nights > maxNights) continue;
          }
          const returnPairs = tripType === 'openjaw'
            ? returnOrigins.flatMap(ro => returnDestinations.map(rd => [ro, rd])).filter(([ro, rd]) => ro !== rd)
            : [[destination, origin]];
          for (const [returnOrigin, returnDestination] of returnPairs) {
            for (const cabin of cabins) {
              const legs = [makeLeg({ origin, destination, date: outboundDate, direction: 'OUTBOUND', ordinal: 1 })];
              if (returnDate) legs.push(makeLeg({ origin: returnOrigin, destination: returnDestination, date: returnDate, direction: 'RETURN', ordinal: 2 }));
              tasks.push(normalizeQuery({
                queryId: crypto.randomUUID(), adapter, origin, destination, outboundDate, returnDate,
                returnOrigin: returnDate ? returnOrigin : '', returnDestination: returnDate ? returnDestination : '',
                tripType, adults, cabin, legs, constraints
              }));
            }
          }
        }
      }
    }
  }

  const originOrder = new Map(origins.map((v, i) => [v, i]));
  const destinationOrder = new Map(destinations.map((v, i) => [v, i]));
  const cabinOrder = new Map(cabins.map((v, i) => [v, i]));
  tasks.forEach(task => { task.priority_score = smartScore(task, input, originOrder, destinationOrder, cabinOrder); });
  if (input.smartOrder !== false) tasks.sort((a, b) => a.priority_score - b.priority_score);
  return tasks;
}

export function matrixSummary(tasks, retriesPerQuery = 1) {
  return {
    queries: tasks.length,
    origins: new Set(tasks.map(t => t.origin)).size,
    destinations: new Set(tasks.map(t => t.destination)).size,
    cabins: new Set(tasks.map(t => t.cabin)).size,
    maximum_attempts: tasks.length * Math.max(1, Number(retriesPerQuery) || 1),
    trip_types: [...new Set(tasks.map(t => t.tripType))]
  };
}

export { dateRange, nightsBetween };

