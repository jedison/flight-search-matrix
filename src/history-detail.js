function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[character]));
}

function priceText(row) {
  if (row.mileage_price) return `${row.mileage_price} miles`;
  if (row.cash_total_per_person !== '') return `${row.currency || ''} ${row.cash_total_per_person} per person, fees included`.trim();
  if (row.cash_price !== '') return `${row.currency || ''} ${row.cash_price} (${row.price_kind || 'unqualified'})`.trim();
  return '';
}

export function historyDetailHtml(rows, limit=3) {
  if (!rows.length) return '<p>No observations found for this query.</p>';
  const counts = rows.reduce((summary, row) => {
    const status = row.status || 'INCONCLUSIVE';
    summary[status] = (summary[status] || 0) + 1;
    return summary;
  }, {});
  const shown = rows.slice(0, limit);
  const statusSummary = Object.entries(counts).map(([status, count]) => `${count} ${status}`).join(', ');
  const attempts = shown.map(row => {
    const checkedAt = String(row.checked_at || '');
    const displayTime = checkedAt ? checkedAt.slice(0, 19).replace('T', ' ') : 'Time unavailable';
    const price = priceText(row);
    return `<li><div class="history-attempt-heading"><time datetime="${escapeHtml(checkedAt)}">${escapeHtml(displayTime)}</time><strong class="status-${escapeHtml(row.status || 'INCONCLUSIVE')}">${escapeHtml(row.status || 'INCONCLUSIVE')}</strong><span>Attempt ${escapeHtml(row.attempt || 1)}</span></div><p>${escapeHtml(row.status_detail || 'No additional detail was recorded.')}</p>${price ? `<span class="history-attempt-price">${escapeHtml(price)}</span>` : ''}</li>`;
  }).join('');
  const remainder = rows.length - shown.length;
  return `<p class="history-summary">${rows.length} observation${rows.length === 1 ? '' : 's'} recorded: ${escapeHtml(statusSummary)}.</p><ol class="history-attempts">${attempts}</ol>${remainder ? `<p class="muted">${remainder} older observation${remainder === 1 ? '' : 's'} retained in the downloadable diagnostic.</p>` : ''}`;
}
