(() => {
  if (window.__FSM_MILES_AND_MORE_LOADED__) return;
  window.__FSM_MILES_AND_MORE_LOADED__ = true;

  const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const text = el => (el?.innerText || el?.textContent || '').trim();
  const norm = value => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const runTrace = [];
  const runFlags = new Map();
  function trace(step, detail={}) {
    runTrace.push({at:new Date().toISOString(),step,...detail});
    if(runTrace.length>80) runTrace.shift();
  }
  function activity(runId, step, detail, phase='ACTIVE') {
    trace(step,{detail,phase});
    chrome.runtime.sendMessage({type:'ADAPTER_ACTIVITY',runId,step,detail,phase}).catch(()=>{});
  }
  function runControl(runId) {
    const flags=runFlags.get(runId);
    if (flags?.cancelled) return 'CANCELLED';
    if (flags?.pauseRequested) return 'PAUSED';
    return null;
  }

  function deepAll(selector, root=document) {
    const out=[];
    const visit=node=>{
      if (!node?.querySelectorAll) return;
      out.push(...node.querySelectorAll(selector));
      for (const el of node.querySelectorAll('*')) if (el.shadowRoot) visit(el.shadowRoot);
    };
    visit(root);
    return [...new Set(out)];
  }

  function candidateControls() {
    return deepAll('input, button, select, [role="combobox"], [role="textbox"], [role="button"], [tabindex], [aria-label], [data-testid]').filter(visible);
  }

  function descriptorText(el) {
    const attrs=[el.getAttribute?.('aria-label'),el.getAttribute?.('placeholder'),el.getAttribute?.('name'),el.id,el.getAttribute?.('data-testid'),el.getAttribute?.('title')].filter(Boolean);
    const labels=[];
    if(el.id){ const label=deepAll(`label[for="${CSS.escape(el.id)}"]`).find(visible); if(label) labels.push(text(label)); }
    const parentText=text(el.closest?.('label,fieldset,div,section') || el).slice(0,240);
    return norm([...attrs,...labels,parentText,text(el)].join(' '));
  }

  function scoreControl(el, terms) {
    const haystack=descriptorText(el);
    return Math.max(...terms.map(term=>haystack.includes(norm(term))?norm(term).length:0),0);
  }

  function findControl(terms, filter=()=>true) {
    return candidateControls().filter(filter).map(el=>({el,score:scoreControl(el,terms)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score)[0]?.el || null;
  }

  function fireInput(el, value) {
    if(!el) return false;
    el.focus?.();
    if('value' in el){
      const proto=Object.getPrototypeOf(el);
      const desc=Object.getOwnPropertyDescriptor(proto,'value') || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
      if(desc?.set) desc.set.call(el,value); else el.value=value;
      el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
    }
    return true;
  }

  async function setTextControl(el, value) {
    if(!el) return false;
    el.click?.();
    await sleep(120);
    fireInput(el,'');
    await sleep(80);
    fireInput(el,value);
    await sleep(700);
    return true;
  }

  function airportOptionCandidates() {
    return deepAll('[role="option"], li, button, [data-testid], a').filter(visible);
  }

  async function chooseAirportSuggestion(code) {
    const normalized=String(code||'').toUpperCase();
    for(let pass=0; pass<10; pass++){
      const candidates=airportOptionCandidates();
      const exact=candidates.find(el=>{
        const t=(text(el)||el.getAttribute?.('aria-label')||'').toUpperCase();
        return new RegExp(`(^|[^A-Z])${normalized}([^A-Z]|$)`).test(t) && !/NO RESULTS FOUND/i.test(t);
      });
      if(exact){ exact.click(); return true; }
      await sleep(250);
    }
    return false;
  }

  async function fillAirport(kind, code) {
    const terms=kind==='origin' ? ['departure from','departure','origin','from'] : ['arrival at','arrival','destination','to'];
    const exactId=kind==='origin' ? 'id-outboundfrom-textfield' : 'id-outboundto-textfield';
    let el=deepAll(`#${exactId}`).find(visible) ||
      findControl(terms,el=>el.tagName==='INPUT'||el.getAttribute?.('role')==='combobox'||el.getAttribute?.('role')==='textbox');
    if(!el){
      const opener=findControl(terms);
      opener?.click?.(); await sleep(250);
      el=deepAll(`#${exactId}`).find(visible) ||
        findControl(terms,el=>el.tagName==='INPUT'||el.getAttribute?.('role')==='combobox'||el.getAttribute?.('role')==='textbox');
    }
    if(!el) { trace('airport-control-missing',{kind,code,exactId}); return false; }
    await setTextControl(el,code);
    const typed=String(el.value||'');
    trace('airport-typed',{kind,code,exactId:el.id||'',value:typed});
    if(!typed.toUpperCase().includes(String(code||'').toUpperCase())) return false;
    const selected=await chooseAirportSuggestion(code);
    trace('airport-suggestion',{kind,code,selected,value:String(el.value||'')});
    return selected;
  }

  function fullDateLabels(iso) {
    if(!iso) return [];
    const d=new Date(`${iso}T12:00:00Z`);
    if(Number.isNaN(d.valueOf())) return [iso];
    const long=new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(d);
    const noWeekday=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(d);
    const numeric=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(d);
    return [long,noWeekday,numeric,iso];
  }

  function findDateButton(iso) {
    const labels=fullDateLabels(iso).map(norm);
    return deepAll('button, [role="button"], [role="gridcell"], td, [aria-label], [data-date]').filter(visible).find(el=>{
      const hay=norm([text(el),el.getAttribute?.('aria-label'),el.getAttribute?.('data-date'),el.getAttribute?.('title')].filter(Boolean).join(' '));
      return labels.some(label=>hay===label || hay.includes(label));
    }) || null;
  }

  function findNextMonthButton() {
    return deepAll('button, [role="button"], [aria-label]').filter(visible).find(el=>{
      const hay=norm([text(el),el.getAttribute?.('aria-label'),el.getAttribute?.('title')].filter(Boolean).join(' '));
      return /next month|next calendar month|following month|month next|navigate next/.test(hay);
    }) || null;
  }

  async function clickCalendarDate(iso) {
    for(let i=0;i<30;i++){
      const day=findDateButton(iso);
      if(day){ day.click(); await sleep(250); return true; }
      const next=findNextMonthButton();
      if(!next) break;
      next.click(); await sleep(180);
    }
    return false;
  }

  function compactDate(iso) {
    const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}${m[2]}${m[1]}` : '';
  }

  function formattedDate(iso) {
    const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  }

  async function typeDateRangeDirect(outboundIso, returnIso, tripType, runId) {
    const field=deepAll('input').filter(visible).find(el=>
      el.id==='id-dates-textfield' || el.name==='dates' || norm(el.getAttribute?.('aria-label'))==='travel dates'
    );
    if(!field) return false;
    const outbound=compactDate(outboundIso);
    const inbound=tripType==='oneway' ? '' : compactDate(returnIso);
    if(!outbound || (tripType!=='oneway' && !inbound)) return false;
    const compact=`${outbound}${inbound}`;
    field.click?.(); field.focus?.();
    const native=await chrome.runtime.sendMessage({type:'FSM_MM_NATIVE_DATES',runId,digits:compact}).catch(error=>({ok:false,reason:String(error)}));
    if(!native?.ok) { trace('native-date-entry-failed',{reason:native?.reason||'no response'}); return false; }
    await sleep(900);
    const value=String(field.value||'').replace(/\s+/g,'');
    const expectedOut=formattedDate(outboundIso);
    const expectedIn=tripType==='oneway' ? '' : formattedDate(returnIso);
    return value.includes(expectedOut) && (tripType==='oneway' || value.includes(expectedIn));
  }

  async function fillTravelDates(outboundIso, returnIso, tripType, runId) {
    if(await typeDateRangeDirect(outboundIso,returnIso,tripType,runId)) return true;
    const opener=findControl(['open calendar travel dates','travel dates','calendar']);
    if(!opener) return false;
    opener.click(); await sleep(400);
    const outboundOk=await clickCalendarDate(outboundIso);
    if(!outboundOk) return false;
    if(tripType!=='oneway') {
      const inboundOk=await clickCalendarDate(returnIso);
      if(!inboundOk) return false;
    }
    const select=deepAll('button,[role="button"]').filter(visible).find(el=>norm(text(el)||el.getAttribute?.('aria-label'))==='select');
    if(select){ select.click(); await sleep(300); }
    return true;
  }

  function committedTravelDates(outboundIso, returnIso, tripType) {
    // M&M submits the separate model-bound dates, not the visible range text.
    const expected=[['outbounddate',outboundIso]];
    if(tripType!=='oneway') expected.push(['inbounddate',returnIso]);
    return expected.every(([name,iso])=>{
      const field=deepAll(`#id-${name}-textfield`)[0];
      return !!(iso && field && field.value===formattedDate(iso) &&
        field.getAttribute('data-calendar-date')===iso && field.validity?.valid);
    });
  }

  async function waitForCommittedTravelDates(outboundIso, returnIso, tripType, runId) {
    activity(runId,'DATES_COMMIT_WAIT','Waiting for Miles & More to validate and commit the travel dates.');
    // The site's input splitter and validator each schedule an 800 ms timer.
    // Poll actual validated values; a visible date or a fixed sleep is insufficient.
    const deadline=Date.now()+6000;
    let readySince=null;
    while(Date.now()<deadline) {
      if(runControl(runId)) return false;
      if(committedTravelDates(outboundIso,returnIso,tripType)) {
        readySince ??= Date.now();
        if(Date.now()-readySince>=250) {
          activity(runId,'DATES_COMMITTED',`Miles & More committed travel dates: ${outboundIso}${tripType==='oneway'?'':` / ${returnIso}`}.`);
          return true;
        }
      } else readySince=null;
      await sleep(100);
    }
    activity(runId,'DATES_COMMIT_TIMEOUT','Miles & More did not commit the requested travel dates within 6 seconds. Search flights was not clicked.','NEEDS_USER');
    return false;
  }

  function controlValueText(el) {
    if(!el) return '';
    const selected=[...el.querySelectorAll?.('[aria-selected="true"],[data-selected="true"],option:checked')||[]].map(text).join(' ');
    return norm([text(el),el.getAttribute?.('aria-label'),el.getAttribute?.('data-value'),el.getAttribute?.('value'),selected].filter(Boolean).join(' '));
  }

  async function selectDropdown(currentTerms, desiredTerms) {
    const opener=findControl(currentTerms, el=>!el.matches?.('option,li,[role="option"]'));
    if(!opener) return false;
    opener.click(); await sleep(250);
    const option=deepAll('button, [role="option"], li, label, [role="menuitem"], [aria-label]').filter(visible).find(el=>{
      const hay=norm([text(el),el.getAttribute?.('aria-label')].filter(Boolean).join(' '));
      return desiredTerms.some(term=>hay===norm(term)||hay.includes(norm(term)));
    });
    if(!option) return false;
    option.click(); await sleep(300);
    return desiredTerms.some(term=>controlValueText(opener).includes(norm(term)) ||
      norm(document.body?.innerText||'').includes(norm(term)) && /one way|round ?trip/.test(norm(text(opener))));
  }

  async function setTravelType(tripType) {
    const desired=tripType==='oneway' ? ['one way','one-way'] : ['roundtrip','round trip'];
    const current=findControl(['travel type'], el=>!el.matches?.('option,li,[role="option"]'));
    if(!current) return false;
    if(desired.some(x=>controlValueText(current).includes(norm(x)))) return true;
    current.click(); await sleep(250);
    const option=deepAll('button,[role="option"],li,label,[role="menuitem"],[aria-label]').filter(visible).find(el=>{
      const hay=norm([text(el),el.getAttribute?.('aria-label'),el.getAttribute?.('data-value'),el.getAttribute?.('value')].filter(Boolean).join(' '));
      return desired.some(term=>hay===norm(term)||hay.includes(norm(term)));
    });
    if(!option) return false;
    option.click(); await sleep(450);
    const after=controlValueText(current);
    return desired.some(x=>after.includes(norm(x)));
  }

  function cabinCode(cabin) {
    return {economy:'E',premium:'PE','premium economy':'PE',business:'B',first:'F'}[norm(cabin)] || '';
  }

  function cabinMatches(cabin) {
    const field=deepAll('select[name="classofservice"]')[0];
    return !!(cabinCode(cabin) && field && field.value===cabinCode(cabin));
  }

  async function setCabin(cabin) {
    if(cabinMatches(cabin)) return true;
    const desired={E:'economy',PE:'premium economy',B:'business',F:'first'}[cabinCode(cabin)];
    if(!desired) return false;
    const opener=findControl(['select travel class','travel class']);
    if(!opener) return false;
    opener.click(); await sleep(250);
    const option=deepAll('[role="option"], li[data-name], button').filter(visible).find(el=>
      norm(text(el))===desired || el.getAttribute?.('data-name')===cabinCode(cabin));
    if(!option) return false;
    option.click();
    for(let i=0;i<20;i++) {
      await sleep(100);
      if(cabinMatches(cabin)) return true;
    }
    return false;
  }

  function findSearchButton() {
    const controls=deepAll('button, input[type="submit"], [role="button"]').filter(visible);
    const label=el=>norm([text(el),el.value,el.getAttribute?.('aria-label'),el.getAttribute?.('title'),el.getAttribute?.('data-testid')].filter(Boolean).join(' '));
    return controls.find(el=>/^search flights?$/i.test(label(el))) ||
      controls.find(el=>/\bsearch flights?\b|\bfind flights?\b/i.test(label(el))) || null;
  }

  function searchSubmissionAcknowledged(button, beforeText) {
    const current=findSearchButton();
    const form=button.closest?.('form');
    const busy=deepAll('[aria-busy="true"], [data-loading="true"], [data-state="loading"], [data-status="loading"]').some(visible);
    const changedButton=!current || current!==button || current.disabled || current.getAttribute?.('aria-disabled')==='true' ||
      controlValueText(current)!==beforeText || /loading|searching|please wait/.test(norm(text(current)));
    const changedForm=form && (form.getAttribute?.('aria-busy')==='true' || /loading|searching|please wait/.test(norm(text(form))));
    return !!(busy || changedButton || changedForm);
  }

  function installNativeClickTrace(runId, button) {
    const events=[];
    const record=event=>events.push({type:event.type,trusted:event.isTrusted===true,target:event.target?.getAttribute?.('aria-label')||event.target?.id||event.target?.tagName||'',at:Date.now()});
    const pointerEvents=['pointerdown','mousedown','pointerup','mouseup','click'];
    pointerEvents.forEach(type=>document.addEventListener(type,record,true));
    const form=button.closest?.('form');
    form?.addEventListener('submit',record,true);
    return {
      events,
      cleanup:()=>{
        pointerEvents.forEach(type=>document.removeEventListener(type,record,true));
        form?.removeEventListener('submit',record,true);
      }
    };
  }

  async function prepareNativeSearchClick(runId) {
    let button=findSearchButton();
    if(!button) return {ok:false,reason:'Search flights control is not visible.'};
    if(button.disabled || button.getAttribute?.('aria-disabled')==='true') return {ok:false,reason:'Search flights is disabled.'};
    button.scrollIntoView?.({block:'center',inline:'nearest'});
    await sleep(180);
    button=findSearchButton();
    if(!button) return {ok:false,reason:'Search flights moved or disappeared while preparing the native click.'};
    if(button.disabled || button.getAttribute?.('aria-disabled')==='true') return {ok:false,reason:'Search flights became disabled while preparing the native click.'};
    button.focus?.();
    const rect=button.getBoundingClientRect?.() || {left:0,top:0,width:0,height:0};
    if(rect.width<2 || rect.height<2) return {ok:false,reason:'Search flights does not have a clickable on-screen area.'};
    const x=rect.left+rect.width/2, y=rect.top+rect.height/2;
    const hit=document.elementFromPoint?.(x,y);
    const shadowHost=button.getRootNode?.()?.host;
    const onButton=!!hit && (hit===button || button.contains?.(hit) || hit===shadowHost || hit.closest?.('button, input[type="submit"], [role="button"]')===button);
    if(!onButton) {
      const hitDescription=norm([hit?.tagName,hit?.id,hit?.getAttribute?.('aria-label'),text(hit)].filter(Boolean).join(' ')).slice(0,120) || 'an unknown page element';
      return {ok:false,reason:`Search flights is not at its expected click point; it is covered by ${hitDescription}.`};
    }
    const clickTrace=installNativeClickTrace(runId,button);
    runFlags.set(runId,{...(runFlags.get(runId)||{}),searchButton:button,searchBeforeText:controlValueText(button),clickTrace});
    activity(runId,'SEARCH_FLIGHTS_TARGET','Search flights target confirmed for native click.','WAITING_FOR_RESULTS');
    activity(runId,'SEARCH_FLIGHTS_NATIVE','Using Chrome native input for one Search flights click.','WAITING_FOR_RESULTS');
    return {ok:true,target:{x,y}};
  }

  function recheckNativeSearchClickTarget(runId) {
    const flags=runFlags.get(runId);
    if(!flags) return {ok:false,reason:'Search flights activation state was lost before the native click.'};
    const button=findSearchButton();
    if(!button) return {ok:false,reason:'Search flights disappeared after the hover update.'};
    if(button.disabled || button.getAttribute?.('aria-disabled')==='true') return {ok:false,reason:'Search flights became disabled after the hover update.'};
    const rect=button.getBoundingClientRect?.() || {left:0,top:0,width:0,height:0};
    if(rect.width<2 || rect.height<2) return {ok:false,reason:'Search flights no longer has a clickable on-screen area after the hover update.'};
    const x=rect.left+rect.width/2, y=rect.top+rect.height/2;
    const hit=document.elementFromPoint?.(x,y);
    const shadowHost=button.getRootNode?.()?.host;
    const onButton=!!hit && (hit===button || button.contains?.(hit) || hit===shadowHost || hit.closest?.('button, input[type="submit"], [role="button"]')===button);
    if(!onButton) return {ok:false,reason:'Search flights is covered after the hover update.'};
    runFlags.set(runId,{...flags,searchButton:button,searchBeforeText:controlValueText(button)});
    activity(runId,'SEARCH_FLIGHTS_TARGET_REFRESHED','Search flights target refreshed after the M&M hover update.','WAITING_FOR_RESULTS');
    return {ok:true,target:{x,y}};
  }

  function findOutboundCabinButton(cabin) {
    const requested=norm(cabin);
    return deepAll('button,[role="button"]').filter(visible).find(el=>{
      const label=norm([text(el),el.getAttribute?.('aria-label')].filter(Boolean).join(' '));
      return requested && label.includes(requested) && /\bfrom\b/.test(label) && /\b(?:miles|meilen)\b/.test(label) && !/no offer/.test(label);
    }) || null;
  }

  function outboundFareTarget(button) {
    if(!button) return {ok:false,reason:'No offered outbound cabin control is visible.'};
    button.scrollIntoView?.({block:'center',inline:'nearest'});
    const rect=button.getBoundingClientRect?.() || {left:0,top:0,width:0,height:0};
    if(rect.width<2 || rect.height<2) return {ok:false,reason:'The requested outbound cabin control has no clickable on-screen area.'};
    const x=rect.left+rect.width/2, y=rect.top+rect.height/2;
    const hit=document.elementFromPoint?.(x,y);
    if(!(hit===button || button.contains?.(hit) || hit?.closest?.('button,[role="button"]')===button)) return {ok:false,reason:'The requested outbound cabin control is covered.'};
    return {ok:true,target:{x,y}};
  }

  async function prepareOutboundFareFamily(runId, cabin) {
    const button=findOutboundCabinButton(cabin);
    const ready=outboundFareTarget(button);
    if(!ready.ok) return ready;
    runFlags.set(runId,{...(runFlags.get(runId)||{}),outboundFareButton:button,outboundCabin:cabin});
    activity(runId,'OUTBOUND_FARE_TARGET',`Opening the first visible ${cabin} outbound fare family.`,'WAITING_FOR_RESULTS');
    return ready;
  }

  function recheckOutboundFareFamily(runId) {
    const button=findOutboundCabinButton(runFlags.get(runId)?.outboundCabin);
    // M&M rerenders on hover. Find the same requested-cabin control again if the old node was replaced.
    const fallback=button || deepAll('button,[role="button"]').filter(visible).find(el=>/\bfrom\b/.test(norm(text(el))) && /\b(?:miles|meilen)\b/.test(norm(text(el))));
    const ready=outboundFareTarget(fallback);
    if(ready.ok) runFlags.set(runId,{...(runFlags.get(runId)||{}),outboundFareButton:fallback});
    return ready;
  }

  function outboundFareFamiliesOpen() {
    return deepAll('button').filter(visible).some(el=>/^select\s+.+\s+and continue$/i.test(el.getAttribute?.('aria-label')||text(el)||''));
  }

  function findExpandedFareSelectButton() {
    return deepAll('button').filter(visible).find(el=>/^select\s+.+\s+and continue$/i.test(el.getAttribute?.('aria-label')||text(el)||'')) || null;
  }

  async function prepareExpandedFareSelection(runId) {
    const button=findExpandedFareSelectButton();
    const ready=outboundFareTarget(button);
    if(!ready.ok) return ready;
    runFlags.set(runId,{...(runFlags.get(runId)||{}),expandedFareSelectLabel:button.getAttribute?.('aria-label')||text(button)});
    activity(runId,'OUTBOUND_FARE_SELECT_TARGET',`Selecting ${button.getAttribute?.('aria-label')||'the opened outbound fare'}.`,'WAITING_FOR_RESULTS');
    return ready;
  }

  function recheckExpandedFareSelection(runId) {
    const wanted=norm(runFlags.get(runId)?.expandedFareSelectLabel);
    const button=deepAll('button').filter(visible).find(el=>norm(el.getAttribute?.('aria-label')||text(el))===wanted) || findExpandedFareSelectButton();
    return outboundFareTarget(button);
  }

  function submittedSearch() {
    try {
      const post=JSON.parse(document.querySelector('[data-post]')?.getAttribute('data-post') || '{}');
      const payload=typeof post.search==='string' ? JSON.parse(post.search) : post.search;
      // Return only travel dates, not account/session data from the page.
      if(Array.isArray(payload?.itineraries)) return {itineraries:payload.itineraries.map(leg=>({departureDateTime:leg.departureDateTime}))};
    } catch {}
    return null;
  }

  function confirmNativeSearchClick(runId) {
    const flags=runFlags.get(runId);
    if(!flags?.searchButton) return {ok:false,reason:'Search flights activation state was lost before confirmation.'};
    flags.clickTrace?.cleanup?.();
    const trace=flags.clickTrace?.events || [];
    return searchSubmissionAcknowledged(flags.searchButton,flags.searchBeforeText)
      ? {ok:true,trace}
      : {ok:false,reason:'Miles & More did not acknowledge the native Search flights click. No result loading or submission state appeared.',trace};
  }

  function formReadiness() {
    const required=[['departure',deepAll('#id-outboundfrom-textfield').find(visible)],['arrival',deepAll('#id-outboundto-textfield').find(visible)],['travel dates',deepAll('#id-dates-textfield').find(visible)],['Search flights',findSearchButton()]];
    return {ready:required.every(([,el])=>!!el),missing:required.filter(([,el])=>!el).map(([name])=>name)};
  }

  function detectBlockingState() {
    const body=norm(document.body?.innerText||'');
    if(/captcha|verify you are human|security check|verification code|two-factor|2-factor|identity verification/.test(body)) return {status:'NEEDS_USER',statusDetail:'Authentication or human verification is required in the page.',rawExcerpt:body.slice(0,1200)};
    if(/technical error|something went wrong|try again later|temporarily unavailable|timeout|timed out/.test(body)) return {status:'INCONCLUSIVE',statusDetail:'Miles & More displayed a technical error or timeout.',rawExcerpt:body.slice(0,1200)};
    return null;
  }

  function parseNumber(raw) {
    const cleaned=String(raw||'').replace(/\s/g,'').replace(/(?<=\d)[,.](?=\d{3}(\D|$))/g,'').replace(',','.');
    const match=cleaned.match(/\d+(?:\.\d+)?/); return match?Number(match[0]):'';
  }

  function resultSignals(bodyText) {
    const flightNumbers=[...new Set(bodyText.match(/\b[A-Z]{2,3}\s?\d{1,4}\b/g)||[])].slice(0,20);
    const resultSection=(bodyText.match(/Flight results on[\s\S]{0,12000}/i)||[''])[0];
    const fareText=resultSection || bodyText;
    const milesMatches=[...fareText.matchAll(/([\d.,\s]+)\s*(?:miles|meilen)/gi)].map(m=>parseNumber(m[1])).filter(v=>v!=='' && v<1000000);
    const resultPage=/Flight results on/i.test(resultSection) && /(?:Below are\s+\d+\s+flights|Please select your departure)/i.test(resultSection);
    const strongFlightEvidence=resultPage && milesMatches.length>0;
    return {flightNumbers,milesMatches,resultSection,resultPage,strongFlightEvidence};
  }

  function fareOffers(resultSection) {
    const offers=[];
    const pattern=/(?:^|\n)\s*(Economy|Premium\s+Economy|Business)\s*(?:\n\s*Mixed classes)?\s*\n\s*from\s*\n\s*([\d.,\s]+)\s*\n\s*(?:Miles|Meilen)\s*\n\s*\+\s*\n\s*([A-Z]{3})\s*([\d.,\s]+)/gi;
    for(const match of String(resultSection||'').matchAll(pattern)) {
      const mileagePrice=parseNumber(match[2]);
      const fees=parseNumber(match[4]);
      if(mileagePrice==='') continue;
      offers.push({cabin:norm(match[1]),mileagePrice,fees,feesCurrency:match[3]});
    }
    return offers;
  }

  function itineraryOffers(resultSection) {
    const section=String(resultSection||'');
    const blocks=section.split(/(?=(?:^|\n)\d{2}:\d{2}\nDeparture date:)/).filter(block=>/\d{2}:\d{2}\nDeparture date:/.test(block));
    const rows=[];
    for(const block of blocks) {
      const departureTime=(block.match(/(?:^|\n)(\d{2}:\d{2})\nDeparture date:/)||[])[1]||'';
      const arrivalTime=(block.match(/(?:^|\n)(\d{2}:\d{2})\nArrival date:/)||[])[1]||'';
      const stops=parseNumber((block.match(/(?:^|\n)(\d+)\nstop(?:\n|$)/i)||[])[1]);
      const durationMatch=block.match(/Duration\s+(\d+)h\s*(\d+)m/i);
      const durationMinutes=durationMatch ? Number(durationMatch[1])*60+Number(durationMatch[2]) : '';
      const carrierBlock=(block.match(/Operated by\s*\n([\s\S]{0,320}?)(?=\n(?:See itinerary details|Aircraft type|Economy|Premium Economy|Business)\b)/i)||[])[1]||'';
      const operatingCarrier=carrierBlock.split('\n').map(part=>part.trim()).filter(part=>part && !/^Operated by$/i.test(part) && !/^[,;|]+$/.test(part)).join(' | ');
      for(const offer of fareOffers(block)) rows.push({...offer,departureTime,arrivalTime,connections:stops,durationMinutes,operatingCarrier,itineraryStage:'OUTBOUND_SELECTION'});
    }
    // Keep a safe fallback for compact pages where individual itinerary text is not exposed.
    return rows.length ? rows : fareOffers(section).map(offer=>({...offer,departureTime:'',arrivalTime:'',connections:'',durationMinutes:'',operatingCarrier:'',itineraryStage:'OUTBOUND_SELECTION'}));
  }

  function parseResults(query={}) {
    const blocker=detectBlockingState(); if(blocker) return blocker;
    const bodyText=document.body?.innerText||''; const lower=norm(bodyText);
    const strongNoResult=/no flights found|sorry, no result on this date|unfortunately, we haven.?t found a flight|no offer/.test(lower);
    const {resultSection,resultPage,strongFlightEvidence}=resultSignals(bodyText);
    const requestedCabin=norm(query.cabin);
    const offers=itineraryOffers(resultSection);
    const matchingOffers=requestedCabin ? offers.filter(offer=>offer.cabin===requestedCabin) : offers;
    if(strongNoResult && !strongFlightEvidence) return {status:'NO_RESULT',statusDetail:'The completed Miles & More search explicitly displayed no flights/no offer.',rawExcerpt:bodyText.slice(0,1800)};
    if(resultPage && matchingOffers.length) {
      const lowest=matchingOffers.reduce((best,offer)=>{
        if(offer.mileagePrice!==best.mileagePrice) return offer.mileagePrice<best.mileagePrice ? offer : best;
        const offerFees=Number.isFinite(Number(offer.fees)) ? Number(offer.fees) : Infinity;
        const bestFees=Number.isFinite(Number(best.fees)) ? Number(best.fees) : Infinity;
        return offerFees<bestFees ? offer : best;
      });
      const flightCount=(resultSection.match(/Below are\s+(\d+)\s+flights/i)||[])[1];
      const cabinLabel=requestedCabin || lowest.cabin;
      const observationCandidates=matchingOffers.map(offer=>({status:'AVAILABLE',confidence:'LIKELY',mileagePrice:offer.mileagePrice,mileageScope:'PER_PERSON',fees:offer.fees,feesCurrency:offer.feesCurrency,feesScope:'PER_PERSON',feesIncluded:false,priceKind:'UNKNOWN',priceComparable:false,observedCabin:offer.cabin,departureTime:offer.departureTime,arrivalTime:offer.arrivalTime,connections:offer.connections,durationMinutes:offer.durationMinutes,operatingCarrier:offer.operatingCarrier,itineraryStage:offer.itineraryStage}));
      return {status:'AVAILABLE',confidence:'LIKELY',statusDetail:`Miles & More result list${flightCount ? ` with ${flightCount} flights` : ''} confirmed. Saved ${matchingOffers.length} visible ${cabinLabel} offer(s); current lowest is ${lowest.mileagePrice} miles plus ${lowest.feesCurrency} ${lowest.fees}.`,mileagePrice:lowest.mileagePrice,mileageScope:'PER_PERSON',fees:lowest.fees,feesCurrency:lowest.feesCurrency,feesScope:'PER_PERSON',feesIncluded:false,priceKind:'UNKNOWN',priceComparable:false,observationCandidates,rawExcerpt:bodyText.slice(0,1800)};
    }
    if(strongFlightEvidence) return {status:'INCONCLUSIVE',statusDetail:`Miles & More result list loaded, but no visible ${requestedCabin || 'award'} fare card was recognized.`,rawExcerpt:bodyText.slice(0,1800)};
    return {status:'INCONCLUSIVE',statusDetail:'Search page loaded, but the parser could not identify a conclusive award result.',rawExcerpt:bodyText.slice(0,1800)};
  }

  async function waitForResults(timeoutMs=35000, runId, query={}) {
    const deadline=Date.now()+Math.max(5000,Number(timeoutMs)||35000);
    let last=parseResults(query);
    while(Date.now()<deadline){
      const control=runControl(runId); if(control) return {control};
      if(last.status!=='INCONCLUSIVE') return last;
      await sleep(1000); last=parseResults(query);
    }
    return {...last,statusDetail:`${last.statusDetail} Timed out waiting for a conclusive page state.`};
  }

  async function runQuery(query, runId) {
    runFlags.set(runId,{cancelled:false,pauseRequested:false});
    const blocker=detectBlockingState(); if(blocker) return {state:'PARSED',parsed:blocker};
    if(query.tripType==='openjaw') return {state:'PARSED',parsed:{status:'NEEDS_USER',statusDetail:'Open-jaw M&M search still requires calibration.',rawExcerpt:(document.body?.innerText||'').slice(0,1400)}};
    activity(runId,'TRAVEL_TYPE','Setting and verifying travel type.');
    const travelTypeOk=await setTravelType(query.tripType);
    if(runControl(runId)) return {state:runControl(runId)};
    activity(runId,'ORIGIN','Entering and selecting the departure airport.');
    const originOk=await fillAirport('origin',query.origin);
    if(runControl(runId)) return {state:runControl(runId)};
    activity(runId,'DESTINATION','Entering and selecting the arrival airport.');
    const destinationOk=await fillAirport('destination',query.destination);
    if(runControl(runId)) return {state:runControl(runId)};
    activity(runId,'CABIN','Setting and verifying travel class after airport selection.');
    const cabinOk=await setCabin(query.cabin);
    if(runControl(runId)) return {state:runControl(runId)};
    activity(runId,'DATES','Entering and verifying travel dates.');
    const datesEntered=await fillTravelDates(query.outboundDate,query.returnDate,query.tripType,runId);
    const datesOk=datesEntered && await waitForCommittedTravelDates(query.outboundDate,query.returnDate,query.tripType,runId);
    if(runControl(runId)) return {state:runControl(runId)};
    activity(runId,'PASSENGERS_DEFAULT','Using Miles & More default of 1 passenger for current calibration.');
    if(runControl(runId)) return {state:runControl(runId)};
    const finalCabinOk=cabinOk && cabinMatches(query.cabin);
    if(!(travelTypeOk&&finalCabinOk&&originOk&&destinationOk&&datesOk)){
      const failures=[['travel type',travelTypeOk],['cabin',finalCabinOk],['origin',originOk],['destination',destinationOk],['travel dates',datesOk]].filter(([,ok])=>!ok).map(([name])=>name);
      const statusDetail=`Miles & More did not confirm: ${failures.join(', ')}.`;
      activity(runId,'FORM_NOT_CONFIRMED',statusDetail,'NEEDS_USER');
      return {state:'PARSED',parsed:{status:'NEEDS_USER',statusDetail,rawExcerpt:(document.body?.innerText||'').slice(0,1800)}};
    }
    const ready=formReadiness();
    if(!ready.ready) {
      const statusDetail=`Miles & More fields were filled, but the form is no longer ready: ${ready.missing.join(', ')}.`;
      activity(runId,'FORM_NOT_CONFIRMED',statusDetail,'NEEDS_USER');
      return {state:'PARSED',parsed:{status:'NEEDS_USER',statusDetail,rawExcerpt:(document.body?.innerText||'').slice(0,1800)}};
    }
    activity(runId,'FORM_FILLED','M&M confirmed that the form controls remain ready after the requested entries.','ACTIVE');
    const submission=await prepareNativeSearchClick(runId);
    if(!submission.ok) {
      const statusDetail=`M&M form is ready, but Search flights could not be activated: ${submission.reason}`;
      activity(runId,'SEARCH_FLIGHTS_NOT_ACTIVATED',statusDetail,'NEEDS_USER');
      return {state:'PARSED',parsed:{status:'NEEDS_USER',statusDetail,rawExcerpt:(document.body?.innerText||'').slice(0,1800)}};
    }
    return {state:'READY_FOR_NATIVE_CLICK',target:submission.target,submittedSearch:submittedSearch()};
  }

  function diagnostic() {
    return {
      url:location.href,
      capturedAt:new Date().toISOString(),
      runTrace:[...runTrace],
      controls:candidateControls().slice(0,120).map((el,i)=>({i,tag:el.tagName,role:el.getAttribute?.('role')||'',type:el.getAttribute?.('type')||'',ariaLabel:el.getAttribute?.('aria-label')||'',placeholder:el.getAttribute?.('placeholder')||'',name:el.getAttribute?.('name')||'',id:el.id||'',testId:el.getAttribute?.('data-testid')||'',value:'value' in el?String(el.value||'').slice(0,120):'',text:text(el).slice(0,160),descriptor:descriptorText(el).slice(0,260)})),
      excerpt:(document.body?.innerText||'').slice(0,7000)
    };
  }

  const PINNED_OVERLAY_ID='fsm-pinned-m-and-m-overlay';
  function removePinnedOverlay() { document.getElementById(PINNED_OVERLAY_ID)?.remove(); }
  function showPinnedOverlay(overlay={}) {
    if(!overlay.active) { removePinnedOverlay(); return; }
    let panel=document.getElementById(PINNED_OVERLAY_ID);
    if(!panel) {
      panel=document.createElement('section'); panel.id=PINNED_OVERLAY_ID;
      panel.style.cssText='position:fixed;top:16px;right:16px;z-index:2147483647;width:280px;padding:12px;border:1px solid #1b4079;border-radius:12px;background:#fff;color:#10285c;box-shadow:0 8px 24px rgba(0,0,0,.22);font:13px/1.4 system-ui,sans-serif';
      document.documentElement.appendChild(panel);
    }
    const recent=(overlay.activity||[]).slice(-2).map(event=>String(event.detail||event.step||'').replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]))).filter(Boolean).join('<br>');
    panel.innerHTML=`<strong style="display:block;font-size:14px">Flight Search Matrix</strong><span style="display:block;margin-top:3px;font-weight:700">${String(overlay.phase||'ACTIVE')}</span><span style="display:block;margin-top:4px">${String(overlay.detail||'Working in Miles & More.').replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]))}</span>${recent?`<small style="display:block;margin-top:7px;color:#40506f">${recent}</small>`:''}<button type="button" data-fsm-unpin style="margin-top:9px;border:1px solid #1b4079;border-radius:6px;background:#fff;color:#10285c;padding:4px 8px;font:inherit;cursor:pointer">Unpin</button>`;
    panel.querySelector('[data-fsm-unpin]').addEventListener('click',()=>chrome.runtime.sendMessage({type:'FSM_UNPIN_M_AND_M_OVERLAY'}).catch(()=>{}),{once:true});
  }
  chrome.storage.local.get(['settings','pinnedMilesAndMoreOverlay']).then(({settings={},pinnedMilesAndMoreOverlay})=>{ if(settings.mmPinnedOverlay) showPinnedOverlay(pinnedMilesAndMoreOverlay); }).catch(()=>{});

  chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
    if(message.type==='FSM_MM_SUBMITTED_SEARCH'){
      sendResponse({search:submittedSearch()}); return false;
    }
    if(message.type==='FSM_MM_READY'){ sendResponse(formReadiness()); return false; }
    if(message.type==='FSM_RUN_QUERY'){ runQuery(message.query,message.runId).then(sendResponse); return true; }
    if(message.type==='FSM_MM_CONFIRM_NATIVE_SEARCH_CLICK'){ sendResponse(confirmNativeSearchClick(message.runId)); return false; }
    if(message.type==='FSM_MM_RECHECK_NATIVE_TARGET'){ sendResponse(recheckNativeSearchClickTarget(message.runId)); return false; }
    if(message.type==='FSM_MM_PREPARE_OUTBOUND_FARE'){ prepareOutboundFareFamily(message.runId,message.cabin).then(sendResponse); return true; }
    if(message.type==='FSM_MM_RECHECK_OUTBOUND_FARE'){ sendResponse(recheckOutboundFareFamily(message.runId)); return false; }
    if(message.type==='FSM_MM_OUTBOUND_FARE_STATE'){ sendResponse({open:outboundFareFamiliesOpen()}); return false; }
    if(message.type==='FSM_MM_PREPARE_EXPANDED_FARE_SELECT'){ prepareExpandedFareSelection(message.runId).then(sendResponse); return true; }
    if(message.type==='FSM_MM_RECHECK_EXPANDED_FARE_SELECT'){ sendResponse(recheckExpandedFareSelection(message.runId)); return false; }
    if(message.type==='FSM_PAUSE_RUN'){ runFlags.set(message.runId,{...(runFlags.get(message.runId)||{}),pauseRequested:true}); sendResponse({ok:true}); return false; }
    if(message.type==='FSM_CANCEL_RUN'){ runFlags.set(message.runId,{...(runFlags.get(message.runId)||{}),cancelled:true}); sendResponse({ok:true}); return false; }
    if(message.type==='FSM_PARSE_RESULTS'){ sendResponse({state:'PARSED',parsed:parseResults(message.query)}); return false; }
    if(message.type==='FSM_WAIT_FOR_RESULTS'){ waitForResults(message.timeoutMs,message.runId,message.query).then(result=>result?.control ? sendResponse({state:result.control}) : sendResponse({state:'PARSED',parsed:result})); return true; }
    if(message.type==='FSM_CAPTURE_CURRENT'){ sendResponse({state:'PARSED',parsed:parseResults(message.query)}); return false; }
    if(message.type==='FSM_MM_DIAGNOSTIC'){ sendResponse({diagnostic:diagnostic()}); return false; }
    if(message.type==='FSM_PINNED_M_AND_M_STATUS'){ showPinnedOverlay(message.overlay); sendResponse({ok:true}); return false; }
    return false;
  });
})();
