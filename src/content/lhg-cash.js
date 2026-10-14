(() => {
  const VERSION = '0.6.0-experimental';
  const $all = sel => [...document.querySelectorAll(sel)];
  const text = () => document.body?.innerText || '';
  const compact = value => String(value || '').replace(/\s+/g, ' ').trim();
  const lower = value => compact(value).toLowerCase();

  function providerId() {
    return location.hostname.includes('brusselsairlines.com') ? 'brussels-airlines-cash' : 'lufthansa-cash';
  }
  function dispatchInput(el, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles:true }));
    el.dispatchEvent(new Event('change', { bubbles:true }));
  }
  function candidates(labels) {
    const wanted = labels.map(lower);
    return $all('input, textarea, [role="combobox"]').filter(el => {
      const hay = lower([el.getAttribute('aria-label'), el.getAttribute('placeholder'), el.name, el.id].filter(Boolean).join(' '));
      return wanted.some(token => hay.includes(token));
    });
  }
  async function fillAutocomplete(labels, value) {
    const el = candidates(labels)[0];
    if (!el) return false;
    el.focus(); dispatchInput(el, value); await new Promise(r => setTimeout(r, 650));
    const option = $all('[role="option"], li, button').find(node => lower(node.innerText).includes(lower(value)));
    if (option) option.click(); else el.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true }));
    await new Promise(r => setTimeout(r, 250)); return true;
  }
  function dateInputs() {
    return $all('input').filter(el => /date|departure|return|outbound|inbound|depart|retour|rück|hinflug|terug/i.test([el.type,el.name,el.id,el.getAttribute('aria-label'),el.getAttribute('placeholder')].filter(Boolean).join(' ')));
  }
  function fillDates(query) {
    const dates = dateInputs();
    if (!dates.length) return false;
    if (query.outboundDate) dispatchInput(dates[0], query.outboundDate);
    if (query.returnDate && dates[1]) dispatchInput(dates[1], query.returnDate);
    return true;
  }
  function clickByText(patterns) {
    const nodes = $all('button, [role="button"], a');
    const found = nodes.find(node => patterns.some(p => p.test(compact(node.innerText))));
    if (found) { found.click(); return true; }
    return false;
  }
  function parseMoney(value) {
    const cleaned = String(value).replace(/\s/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',', '.').replace(/[^\d.]/g,'');
    const n = Number(cleaned); return Number.isFinite(n) ? n : null;
  }
  function moneyCandidates(body) {
    const out = [];
    const patterns = [
      { re:/€\s*([\d.,\s]+)/g, currency:'EUR' },
      { re:/([\d.,\s]+)\s*EUR\b/g, currency:'EUR' },
      { re:/\$\s*([\d.,\s]+)/g, currency:'USD' },
      { re:/([\d.,\s]+)\s*USD\b/g, currency:'USD' },
      { re:/£\s*([\d.,\s]+)/g, currency:'GBP' }
    ];
    for (const {re,currency} of patterns) for (const m of body.matchAll(re)) { const amount=parseMoney(m[1]); if (amount && amount > 20) out.push({amount,currency,index:m.index||0}); }
    return out;
  }
  function contextAround(body, index, radius=120) { return lower(body.slice(Math.max(0,index-radius), index+radius)); }
  function parsePage(query={}) {
    const body = text(); const l = lower(body);
    if (/captcha|verify you are human|security check|verification code|two-factor|2-factor|sicherheitsüberprüfung/.test(l)) {
      return {status:'NEEDS_USER',confidence:'CONFIRMED',statusDetail:'Authentication or human verification is visible.',parserVersion:VERSION,rawExcerpt:body.slice(0,1800)};
    }
    if (/no flights|no suitable flights|no connections|keine flüge|keine verbindungen|aucun vol|geen vluchten/.test(l)) {
      return {status:'NO_RESULT',confidence:'LIKELY',statusDetail:'The Lufthansa Group page indicates no matching flights.',parserVersion:VERSION,rawExcerpt:body.slice(0,1800)};
    }
    const flightNumbers=[...new Set(body.match(/\b(?:LH|SN|LX|OS|UA|AC|4Y)\s?\d{1,4}\b/g)||[])].slice(0,24);
    const money=moneyCandidates(body);
    const exact = money.filter(p => /total|total price|grand total|price per person|per person|traveller|traveler|inkl|including|taxes|fees|steuern|gebühren|taxes et frais|belastingen|taksen/.test(contextAround(body,p.index)) && !/from|starting|ab |vanaf|à partir|dès/.test(contextAround(body,p.index)));
    const from = money.filter(p => /from|starting|ab |vanaf|à partir|dès/.test(contextAround(body,p.index)));
    const chosen = exact.length ? exact.sort((a,b)=>a.amount-b.amount)[0] : from.sort((a,b)=>a.amount-b.amount)[0];
    if (chosen || flightNumbers.length) {
      const comparable = Boolean(exact.length && chosen);
      return {
        status:'AVAILABLE', confidence:comparable?'CONFIRMED':'LIKELY',
        statusDetail:comparable?'Cash fare captured as a per-person total including fees.':'Candidate Lufthansa Group fare captured, but only a from/summary price was identifiable. It is not used for best-price ranking.',
        cashPrice:chosen?.amount ?? '', currency:chosen?.currency || '', priceScope:'PER_PERSON', feesIncluded:comparable,
        priceKind:comparable?'TOTAL_WITH_FEES':'FROM_FARE', priceComparable:comparable,
        fees:'', feesCurrency:chosen?.currency || '', feesScope:'PER_PERSON',
        flightNumbers, marketingCarrier:providerId()==='brussels-airlines-cash'?'SN':'LH', parserVersion:VERSION, rawExcerpt:body.slice(0,1800)
      };
    }
    return {status:'INCONCLUSIVE',confidence:'INCONCLUSIVE',statusDetail:'No recognizable Lufthansa Group fare/result state was found.',parserVersion:VERSION,rawExcerpt:body.slice(0,1800)};
  }
  async function runQuery(query) {
    if (query.tripType === 'openjaw') return {state:'PARSED',parsed:{status:'NEEDS_USER',statusDetail:'Open-jaw cash automation needs a live Lufthansa Group calibration. Manual capture remains available.',parserVersion:VERSION}};
    const fromOk = await fillAutocomplete(['from','departure','departing','von','de','van','vertrek'], query.origin);
    const toOk = await fillAutocomplete(['to','arrival','arriving','nach','à','naar','aankomst'], query.destination);
    const datesOk = fillDates(query);
    if (!fromOk || !toOk) return {state:'PARSED',parsed:{status:'NEEDS_USER',statusDetail:'Could not identify the Lufthansa Group origin/destination controls. Use diagnostic/manual capture and calibrate selectors.',parserVersion:VERSION,rawExcerpt:text().slice(0,1800)}};
    if (!datesOk) return {state:'PARSED',parsed:{status:'NEEDS_USER',statusDetail:'Could not identify the Lufthansa Group date controls. Use diagnostic/manual capture and calibrate selectors.',parserVersion:VERSION,rawExcerpt:text().slice(0,1800)}};
    const submitted = clickByText([/^find flights$/i,/^search flights$/i,/^flights search$/i,/^flüge suchen$/i,/^rechercher$/i,/^rechercher des vols$/i,/^zoek vluchten$/i]);
    if (!submitted) return {state:'PARSED',parsed:{status:'NEEDS_USER',statusDetail:'Could not identify the Lufthansa Group search button.',parserVersion:VERSION,rawExcerpt:text().slice(0,1800)}};
    return {state:'SUBMITTED'};
  }
  async function waitForResults(timeoutMs=35000, query={}) {
    const start=Date.now(); let last='';
    while (Date.now()-start < timeoutMs) {
      const parsed=parsePage(query); last=parsed.rawExcerpt || last;
      if (['AVAILABLE','NO_RESULT','NEEDS_USER'].includes(parsed.status)) return {state:'PARSED',parsed};
      await new Promise(r=>setTimeout(r,1000));
    }
    return {state:'PARSED',parsed:{status:'INCONCLUSIVE',confidence:'INCONCLUSIVE',statusDetail:'Timed out waiting for a conclusive Lufthansa Group result.',parserVersion:VERSION,rawExcerpt:last.slice(0,1800)}};
  }
  function diagnostic() {
    return {provider:providerId(),url:location.href,inputs:$all('input').slice(0,40).map(el=>({type:el.type,name:el.name,id:el.id,aria:el.getAttribute('aria-label'),placeholder:el.getAttribute('placeholder')})),buttons:$all('button').slice(0,40).map(b=>compact(b.innerText)).filter(Boolean),excerpt:text().slice(0,5000)};
  }
  chrome.runtime.onMessage.addListener((msg,_sender,sendResponse)=>{
    if (msg.type==='FSM_LHG_RUN_QUERY') { runQuery(msg.query||{}).then(sendResponse); return true; }
    if (msg.type==='FSM_LHG_WAIT_FOR_RESULTS') { waitForResults(msg.timeoutMs||35000,msg.query||{}).then(sendResponse); return true; }
    if (msg.type==='FSM_LHG_CAPTURE_CURRENT') { sendResponse({parsed:parsePage(msg.query||{})}); return false; }
    if (msg.type==='FSM_LHG_DIAGNOSTIC') { sendResponse({diagnostic:diagnostic()}); return false; }
    return false;
  });
})();

