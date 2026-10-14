function numeric(values) { return values.map(Number).filter(Number.isFinite); }

export function historicalStats(rows = []) {
  const sorted = [...rows].sort((a, b) => String(a.checked_at || '').localeCompare(String(b.checked_at || '')));
  const available = sorted.filter(r => r.status === 'AVAILABLE');
  const miles = numeric(available.map(r => r.mileage_price).filter(v => v !== ''));
  const cash = numeric(available.filter(r => r.price_comparable === true).map(r => r.cash_total_per_person).filter(v => v !== ''));
  return {
    observations: sorted.length,
    successful_sightings: available.length,
    first_seen: sorted[0]?.checked_at || '',
    last_seen: sorted.at(-1)?.checked_at || '',
    first_available_at: available[0]?.found_at || '',
    last_available_at: available.at(-1)?.found_at || '',
    minimum_mileage_ever: miles.length ? Math.min(...miles) : '',
    minimum_cash_ever: cash.length ? Math.min(...cash) : '',
    current_status: sorted.at(-1)?.status || '',
    availability_reappeared: available.length > 1 && sorted.some((r, i) => i > sorted.indexOf(available[0]) && i < sorted.lastIndexOf(available.at(-1)) && r.status !== 'AVAILABLE')
  };
}

export function chooseCurrentBest(summaries = []) {
  const available = summaries.filter(s => s.final_status === 'AVAILABLE');
  const rows = available.length ? available : summaries;
  return rows.slice().sort((a, b) => {
    const amPresent=a.best_mileage_price!==''&&a.best_mileage_price!==null&&a.best_mileage_price!==undefined;
    const bmPresent=b.best_mileage_price!==''&&b.best_mileage_price!==null&&b.best_mileage_price!==undefined;
    const am = Number(a.best_mileage_price), bm = Number(b.best_mileage_price);
    if (amPresent && bmPresent && Number.isFinite(am) && Number.isFinite(bm) && am !== bm) return am - bm;
    if (amPresent !== bmPresent) return amPresent ? -1 : 1;
    const afPresent=a.best_fees!==''&&a.best_fees!==null&&a.best_fees!==undefined;
    const bfPresent=b.best_fees!==''&&b.best_fees!==null&&b.best_fees!==undefined;
    const af=Number(a.best_fees), bf=Number(b.best_fees);
    if (afPresent && bfPresent && Number.isFinite(af) && Number.isFinite(bf) && af !== bf) return af - bf;
    if (afPresent !== bfPresent) return afPresent ? -1 : 1;
    const acPresent=a.best_cash_price!==''&&a.best_cash_price!==null&&a.best_cash_price!==undefined;
    const bcPresent=b.best_cash_price!==''&&b.best_cash_price!==null&&b.best_cash_price!==undefined;
    const ac = Number(a.best_cash_price), bc = Number(b.best_cash_price);
    if (acPresent && bcPresent && Number.isFinite(ac) && Number.isFinite(bc) && ac !== bc) return ac - bc;
    if (acPresent !== bcPresent) return acPresent ? -1 : 1;
    return String(b.last_checked_at || '').localeCompare(String(a.last_checked_at || ''));
  })[0] || null;
}
