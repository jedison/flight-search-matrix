export const ADAPTER_CAPABILITIES = Object.freeze({
  AUTOMATED_SEARCH: 'AUTOMATED_SEARCH',
  MANUAL_CAPTURE: 'MANUAL_CAPTURE',
  ONE_WAY: 'ONE_WAY',
  ROUND_TRIP: 'ROUND_TRIP',
  OPEN_JAW: 'OPEN_JAW',
  AWARD: 'AWARD',
  CASH: 'CASH'
});

export function validateAdapterDescriptor(descriptor = {}) {
  const errors = [];
  if (!descriptor.id) errors.push('Adapter id is required.');
  if (!descriptor.name) errors.push('Adapter name is required.');
  if (!Array.isArray(descriptor.capabilities)) errors.push('Adapter capabilities must be an array.');
  return { valid: errors.length === 0, errors };
}

export const BUILTIN_ADAPTERS = Object.freeze({
  'miles-and-more': { id: 'miles-and-more', name: 'Miles & More', parserVersion: '0.8.1-itinerary-offers-1', capabilities: [ADAPTER_CAPABILITIES.AUTOMATED_SEARCH, ADAPTER_CAPABILITIES.MANUAL_CAPTURE, ADAPTER_CAPABILITIES.ONE_WAY, ADAPTER_CAPABILITIES.ROUND_TRIP, ADAPTER_CAPABILITIES.OPEN_JAW, ADAPTER_CAPABILITIES.AWARD] },
  'lufthansa-cash': { id: 'lufthansa-cash', name: 'Lufthansa cash', parserVersion: '0.6.0-experimental', capabilities: [ADAPTER_CAPABILITIES.AUTOMATED_SEARCH, ADAPTER_CAPABILITIES.MANUAL_CAPTURE, ADAPTER_CAPABILITIES.ONE_WAY, ADAPTER_CAPABILITIES.ROUND_TRIP, ADAPTER_CAPABILITIES.OPEN_JAW, ADAPTER_CAPABILITIES.CASH] },
  'brussels-airlines-cash': { id: 'brussels-airlines-cash', name: 'Brussels Airlines cash', parserVersion: '0.6.0-experimental', capabilities: [ADAPTER_CAPABILITIES.AUTOMATED_SEARCH, ADAPTER_CAPABILITIES.MANUAL_CAPTURE, ADAPTER_CAPABILITIES.ONE_WAY, ADAPTER_CAPABILITIES.ROUND_TRIP, ADAPTER_CAPABILITIES.OPEN_JAW, ADAPTER_CAPABILITIES.CASH] },
  'manual': { id: 'manual', name: 'Generic manual capture', parserVersion: '1', capabilities: [ADAPTER_CAPABILITIES.MANUAL_CAPTURE, ADAPTER_CAPABILITIES.ONE_WAY, ADAPTER_CAPABILITIES.ROUND_TRIP, ADAPTER_CAPABILITIES.OPEN_JAW, ADAPTER_CAPABILITIES.AWARD, ADAPTER_CAPABILITIES.CASH] }
});
