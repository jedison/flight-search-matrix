export const PRICE_SCOPE = Object.freeze({ PER_PERSON:'PER_PERSON', PARTY_TOTAL:'PARTY_TOTAL', UNKNOWN:'UNKNOWN' });
export const PRICE_KIND = Object.freeze({ TOTAL_WITH_FEES:'TOTAL_WITH_FEES', FROM_FARE:'FROM_FARE', BASE_FARE:'BASE_FARE', UNKNOWN:'UNKNOWN' });

export function comparableCashTotal(parsed = {}, adults = 1) {
  const raw = Number(parsed.cashPrice);
  if (!Number.isFinite(raw)) return '';
  const scope = parsed.priceScope || PRICE_SCOPE.UNKNOWN;
  const feesIncluded = parsed.feesIncluded === true;
  const kind = parsed.priceKind || PRICE_KIND.UNKNOWN;
  if (!feesIncluded || kind !== PRICE_KIND.TOTAL_WITH_FEES) return '';
  if (scope === PRICE_SCOPE.PER_PERSON) return raw;
  if (scope === PRICE_SCOPE.PARTY_TOTAL) return Number(adults) > 0 ? raw / Number(adults) : '';
  return '';
}

export function isComparableCash(parsed = {}, adults = 1) {
  const value = comparableCashTotal(parsed, adults);
  return value !== '' && Number.isFinite(Number(value));
}


