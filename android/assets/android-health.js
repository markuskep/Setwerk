'use strict';
// Android-only adapter; health consent is local to this device and Setwerk account.
window.SetwerkHealth=(()=>{
  let supported=false,granted=false,busy=false,generation=0,lastSync='';
  const owner=()=>window.SetwerkCloud?.user?.id||'guest';
  const key=()=> 'setwerk.health.steps.v1.'+owner();
  const enabled=()=>localStorage.getItem(key())==='true';
  const text=(de,en)=>state.language==='en'?en:de;
  const consent=()=>text('Setwerk liest die Schrittsummen der letzten sieben Tage aus Health Connect. Vorhandene Health-Werte ersetzen manuelle Werte am selben Tag; Tage ohne Daten bleiben unverändert. Bei angemeldetem Konto werden die Schritte auch mit deinem Setwerk-Konto in Firebase synchronisiert. Gastdaten bleiben auf diesem Gerät. Du kannst die Synchronisierung jederzeit stoppen und die Berechtigung in Health Connect widerrufen.','Setwerk reads daily step totals for the last seven days from Health Connect. Health totals replace manual totals on the same day; days without data stay unchanged. When signed in, steps are also synchronized with your Setwerk account in Firebase. Guest data stays on this device. You can stop synchronization and revoke Health Connect access at any time.');
  function controls(){
    if(!supported)return `<p class="meta">${text('Health-Synchronisierung benötigt Android 14 oder neuer.','Health synchronization requires Android 14 or later.')}</p>`;
    const connected=enabled()&&granted;
    return `<div class="stack" style="gap:8px"><p class="meta" role="status">${busy?text('Schritte werden synchronisiert …','Synchronizing steps …'):connected?text('Health Connect verbunden','Health Connect connected')+(lastSync?' · '+lastSync:''):text('Schritte aus Health Connect übernehmen','Import steps from Health Connect')}</p><div style="display:flex;flex-wrap:wrap;gap:8px">${connected?`<button type="button" class="btn outline" data-health="sync" ${busy?'disabled':''}>${text('Synchronisieren','Sync')}</button><button type="button" class="btn outline" data-health="disconnect">${text('Trennen','Disconnect')}</button>`:`<button type="button" class="btn outline" data-health="explain" ${busy?'disabled':''}>${text('Health verbinden','Connect Health')}</button>`}<button type="button" class="btn outline" data-health="settings">${text('Health-Einstellungen','Health settings')}</button></div></div>`;
  }
  function refresh(updateCounts=false){
    if(updateCounts){
      document.querySelectorAll('.steps-card').forEach(card=>{
        card.outerHTML=localizeHTML(stepsCard(card.dataset.stepsDate,route==='calendar'?'calendar':'home'));
      });
      if(route==='calendar'){
        const wrap=document.createElement('div');wrap.innerHTML=calendarWidget(calMonth,selectedDate);
        const grid=document.querySelector('.calendar-grid');if(grid)grid.innerHTML=localizeHTML(wrap.querySelector('.calendar-grid').innerHTML);
      }
    }
    document.querySelectorAll('.steps-card').forEach(card=>{
      let slot=card.querySelector('[data-health-controls]');if(!slot){slot=document.createElement('div');slot.dataset.healthControls='';card.append(slot);}
      slot.innerHTML=controls();
    });
  }
  function message(error){
    if(error.code==='health/permission-denied')return text('Kein Zugriff auf Schritte. Bitte in Health Connect freigeben.','No step access. Please grant permission in Health Connect.');
    return text('Schritte konnten nicht synchronisiert werden. Deine Werte bleiben erhalten.','Steps could not be synchronized. Your saved values are preserved.');
  }
  function apply(days){
    if(!days||typeof days!=='object'||Array.isArray(days))throw Error('Invalid health data');
    const today=G.localDate(),start=new Date(today+'T12:00:00');start.setDate(start.getDate()-6);const earliest=G.localDate(start);
    const entries=Object.entries(days);
    if(entries.length>7||entries.some(([date,count])=>!G.validDate(date)||date<earliest||date>today||!Number.isSafeInteger(count)||count<0))throw Error('Invalid health data');
    const previous=state.dailySteps;
    if(!entries.some(([date,count])=>previous[date]!==count))return false;
    state.dailySteps={...previous,...days};
    if(!save()){state.dailySteps=previous;throw Error('Step storage failed');}
    refresh(true);return true;
  }
  async function run(operation,manual=false){
    if(busy)return;
    const currentOwner=owner(),token=generation,valid=()=>token===generation&&currentOwner===owner();
    busy=true;refresh();
    try{
      const status=await SetwerkNative.call(operation);if(!valid())return;
      supported=status.supported===true;granted=status.granted===true;
      if(operation==='health-connect'){
        if(!supported)throw Object.assign(Error('Unavailable'),{code:'health/unavailable'});
        if(!granted)throw Object.assign(Error('Denied'),{code:'health/permission-denied'});
        localStorage.setItem(key(),'true');
        if(modalKind==='health')closeModal();
      }
      if(enabled()&&granted){
        const result=await SetwerkNative.call('health-read');if(!valid()||!enabled())return;
        // Do not replace a manual entry while its form is open; next resume/sync retries.
        if(modalKind==='steps')return;
        apply(result.days);
        lastSync=new Date().toLocaleTimeString(state.language==='en'?'en-GB':'de-AT',{hour:'2-digit',minute:'2-digit'});
        if(manual)toast(Object.keys(result.days).length?text('Schritte synchronisiert.','Steps synchronized.'):text('Noch keine Schritte in Health Connect. Samsung Health muss Schritte für Health Connect freigeben.','No steps in Health Connect yet. Samsung Health must share steps with Health Connect.'));
      }
    }catch(error){if(valid()){if(error.code==='health/permission-denied')granted=false;if(manual)toast(message(error));}}
    finally{if(valid()){busy=false;refresh();}}
  }
  function disconnect(){generation++;busy=false;lastSync='';localStorage.removeItem(key());refresh();}
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-health]');if(!button)return;
    if(button.dataset.health==='explain'){
      openModal('Health Connect',`<p>${consent()}</p><p>${text('Für Samsung Health: Einstellungen → Health Connect → Schritte zum Schreiben freigeben.','For Samsung Health: Settings → Health Connect → allow writing steps.')}</p><div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn outline" data-action="close-modal">${text('Zurück','Back')}</button><button class="btn accent" data-health="connect">${text('Verbinden','Connect')}</button></div>`,'health');
    }
    if(button.dataset.health==='connect')void run('health-connect',true);
    if(button.dataset.health==='sync')void run('health-status',true);
    if(button.dataset.health==='disconnect')try{disconnect();}catch(error){toast(message(error));}
    if(button.dataset.health==='settings')void SetwerkNative.call('health-settings').catch(error=>toast(message(error)));
  });
  window.addEventListener('setwerk:render',()=>refresh());
  window.addEventListener('setwerk:resume',()=>{void run('health-status');});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void run('health-status');});
  window.addEventListener('setwerk:account-state',event=>{if(event.detail.accountChanged){generation++;busy=false;lastSync='';void run('health-status');}});
  refresh();void run('health-status');
  return {sync:()=>run('health-status',true),disconnect};
})();
