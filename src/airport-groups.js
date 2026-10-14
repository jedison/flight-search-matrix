export const BUILTIN_AIRPORT_GROUPS = Object.freeze({
  NYC: ['JFK', 'EWR', 'LGA'],
  WAS: ['IAD', 'DCA', 'BWI'],
  LON: ['LHR', 'LGW', 'LCY', 'STN', 'LTN'],
  PAR: ['CDG', 'ORY'],
  TYO: ['HND', 'NRT'],
  CHI: ['ORD', 'MDW'],
  YELLOWSTONE_NORTH: ['BZN', 'BIL'],
  YELLOWSTONE_SOUTH: ['JAC', 'IDA', 'SLC']
});

export function parseAirportTokens(value) {
  return [...new Set(String(value || '').replace(/\\n/g, '\n').split(/[\n,;]+/).map(v => v.trim().toUpperCase()).filter(Boolean))];
}

export function expandAirportTokens(value, customGroups = {}) {
  const groups = { ...BUILTIN_AIRPORT_GROUPS, ...customGroups };
  const expanded = [];
  for (const token of parseAirportTokens(value)) {
    const members = groups[token];
    if (Array.isArray(members) && members.length) expanded.push(...members.map(v => String(v).trim().toUpperCase()).filter(Boolean));
    else expanded.push(token);
  }
  return [...new Set(expanded)];
}

