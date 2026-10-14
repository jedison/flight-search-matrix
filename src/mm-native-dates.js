// Use real browser editing events; the M&M mask must update its model too.
export async function enterNativeDateDigits(debuggerApi, tabId, digits, shouldStop=()=>false) {
  if (!/^\d{8}(\d{8})?$/.test(digits)) throw new Error('Expected 8 or 16 compact date digits.');
  const target={tabId};
  await debuggerApi.attach(target,'1.3');
  try {
    const send=async params=>{
      if(shouldStop()) throw new Error('Date entry stopped.');
      await debuggerApi.sendCommand(target,'Input.dispatchKeyEvent',params);
    };
    await send({type:'keyDown',key:'a',code:'KeyA',commands:['selectAll']});
    await send({type:'keyUp',key:'a',code:'KeyA'});
    await send({type:'keyDown',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});
    await send({type:'keyUp',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});
    for(const digit of digits) {
      await send({type:'keyDown',key:digit,code:`Digit${digit}`,text:digit,unmodifiedText:digit,windowsVirtualKeyCode:digit.charCodeAt(0)});
      await send({type:'keyUp',key:digit,code:`Digit${digit}`,windowsVirtualKeyCode:digit.charCodeAt(0)});
    }
    await send({type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    await send({type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  } finally {
    await debuggerApi.detach(target).catch(()=>{});
  }
}

export function validateSubmittedDates(search, query) {
  const expected=query.tripType==='oneway' ? [query.outboundDate] : [query.outboundDate,query.returnDate];
  const actual=search?.itineraries?.map(leg=>leg.departureDateTime);
  return Array.isArray(actual) && actual.length===expected.length && actual.every((date,i)=>!!date && date===expected[i]);
}
