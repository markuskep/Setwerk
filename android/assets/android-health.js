'use strict';
// Step-source consent belongs to this device and Setwerk account, never the cloud.
window.SetwerkHealth=(()=>{
  let supported=false,granted=false,stepSupported=false,stepGranted=false,busy=false,generation=0,lastSync='',timer=null,wasHome=false;
  const owner=()=>window.SetwerkCloud?.user?.id||'guest';
  const key=()=> 'setwerk.health.steps.v1.'+owner();
  const countKey=()=> 'setwerk.phone.steps.v1.'+owner();
  const enabled=()=>localStorage.getItem(key())==='true';
  const counting=()=>localStorage.getItem(countKey())==='true';
  const connected=()=>enabled()&&granted;
  const text=(de,en)=>state.language==='en'?en:de;
  const visibleHome=()=>route==='home'&&!document.hidden;
  const consent=()=>text('Setwerk liest die Schrittsummen der letzten sieben Tage aus Health Connect. Vorhandene Health-Werte ersetzen manuelle Werte am selben Tag; Tage ohne Daten bleiben unverändert. Bei angemeldetem Konto werden die Schritte auch mit deinem Setwerk-Konto in Firebase synchronisiert. Gastdaten bleiben auf diesem Gerät. Du kannst die Synchronisierung in den Kontodaten stoppen und die Berechtigung in Health Connect widerrufen.','Setwerk reads daily step totals for the last seven days from Health Connect. Health totals replace manual totals on the same day; days without data stay unchanged. When signed in, steps are also synchronized with your Setwerk account in Firebase. Guest data stays on this device. You can stop synchronization in account details and revoke Health Connect access.');
  const countConsent=()=>text('Setwerk zählt ab der Aktivierung die Schritte über den Sensor deines Handys, auch wenn die App geschlossen ist. Dafür ist die Freigabe „Körperliche Aktivität“ nötig. Android zeigt eine dauerhafte Schrittzähler-Benachrichtigung. Dein bisheriger Tageswert bleibt als Ausgangswert erhalten. Bei angemeldetem Konto werden die Schritte auch in Firebase gespeichert; Gastdaten bleiben auf diesem Gerät. Du kannst das Zählen in den Kontodaten stoppen. Sobald Health Connect verbunden ist, übernimmt Setwerk dessen Tagessummen und stoppt den eigenen Zähler.','Setwerk counts steps using your phone sensor from activation onward, including when the app is closed. This requires Physical activity permission. Android displays an ongoing step-counter notification. Your existing daily total is kept as the starting value. When signed in, steps are also saved to Firebase; guest data stays on this device. You can stop counting in account details. When Health Connect is connected, Setwerk uses its daily totals and stops its own counter.');
  function button(label,action){return `<button type="button" class="btn outline" data-health="${action}" ${busy?'disabled':''}>${label}</button>`;}
  function statusText(){
    if(busy)return text('Schritte werden aktualisiert …','Updating steps …');
    const source=connected()?text('Health Connect verbunden','Health Connect connected'):counting()&&stepGranted?text('Setwerk zählt deine Handyschritte','Setwerk counts your phone steps'):text('Schritte manuell eintragen oder automatisch zählen','Enter steps manually or count automatically');
    return source+(lastSync?' · '+lastSync:'');
  }
  function controls(settings=false){
    let buttons='';
    if(connected()||counting()&&stepGranted)buttons+=button(text('Synchronisieren','Sync'),'sync');
    if(!settings&&!window.SetwerkCloud?.user&&(connected()||counting()))buttons+=button(text('Kontodaten','Account details'),'guest-settings');
    if(!connected()){
      if(stepSupported&&!(counting()&&stepGranted))buttons+=button(text('Schritte automatisch zählen','Count steps automatically'),'count-explain');
      if(supported)buttons+=button(text('Health verbinden','Connect Health'),'explain');
    }
    if(settings){
      if(enabled())buttons+=button(text('Trennen','Disconnect'),'disconnect');
      if(supported)buttons+=button(text('Health-Einstellungen','Health settings'),'settings');
      if(counting())buttons+=button(text('Schrittzählung stoppen','Stop counting steps'),'count-stop');
    }
    return `<div class="stack" style="gap:8px"><p class="meta" role="status">${statusText()}</p><div style="display:flex;flex-wrap:wrap;gap:8px">${buttons}</div></div>`;
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
    document.querySelectorAll('[data-step-settings]').forEach(slot=>{slot.innerHTML=controls(true);});
  }
  function message(error){
    if(error.code==='health/permission-denied')return text('Kein Zugriff auf Schritte. Bitte in Health Connect freigeben.','No step access. Please grant permission in Health Connect.');
    if(error.code==='steps/permission-denied')return text('Bitte „Körperliche Aktivität“ erlauben, damit Setwerk Schritte zählen kann.','Please allow Physical activity so Setwerk can count steps.');
    if(error.code==='steps/unavailable')return text('Der Handyschrittzähler ist auf diesem Gerät nicht verfügbar.','The phone step counter is unavailable on this device.');
    return text('Schritte konnten nicht synchronisiert werden. Deine Werte bleiben erhalten.','Steps could not be synchronized. Your saved values are preserved.');
  }
  function apply(days){
    if(!days||typeof days!=='object'||Array.isArray(days))throw Error('Invalid step data');
    const today=G.localDate(),start=new Date(today+'T12:00:00');start.setDate(start.getDate()-6);const earliest=G.localDate(start);
    const entries=Object.entries(days);
    if(entries.length>7||entries.some(([date,count])=>!G.validDate(date)||date<earliest||date>today||!Number.isSafeInteger(count)||count<0))throw Error('Invalid step data');
    const previous=state.dailySteps;
    if(!entries.some(([date,count])=>previous[date]!==count))return false;
    state.dailySteps={...previous,...days};
    if(!save()){state.dailySteps=previous;throw Error('Step storage failed');}
    refresh(true);return true;
  }
  async function run(operation='status',manual=false){
    if(busy)return;
    const currentOwner=owner(),token=generation,valid=()=>token===generation&&currentOwner===owner();
    busy=true;refresh();
    try{
      const health=await SetwerkNative.call(operation==='health-connect'?'health-connect':'health-status');if(!valid())return;
      supported=health.supported===true;granted=health.granted===true;
      const phone=await SetwerkNative.call(operation==='steps-connect'?'steps-connect':'steps-status');if(!valid())return;
      stepSupported=phone.supported===true;stepGranted=phone.granted===true;
      if(operation==='health-connect'){
        if(!supported)throw Object.assign(Error('Unavailable'),{code:'health/unavailable'});
        if(!granted)throw Object.assign(Error('Denied'),{code:'health/permission-denied'});
        localStorage.setItem(key(),'true');
        if(modalKind==='health')closeModal();
      }
      if(operation==='steps-connect'){
        if(!stepSupported)throw Object.assign(Error('Unavailable'),{code:'steps/unavailable'});
        if(!stepGranted)throw Object.assign(Error('Denied'),{code:'steps/permission-denied'});
        localStorage.setItem(countKey(),'true');
        if(modalKind==='health')closeModal();
      }
      let source='';
      if(connected()){
        await SetwerkNative.call('steps-stop');if(!valid())return;source='health';
      }else if(counting()&&stepGranted&&stepSupported){
        await SetwerkNative.call('steps-start',{owner:currentOwner,base:state.dailySteps[G.localDate()]||0});if(!valid())return;source='steps';
      }else{await SetwerkNative.call('steps-stop');if(!valid())return;}
      // Automatic imports are restricted to the visible overview. Manual requests work anywhere.
      if(!source||(!manual&&!visibleHome()))return;
      const result=await SetwerkNative.call(source+'-read',source==='steps'?{owner:currentOwner}:{});if(!valid())return;
      if(!manual&&!visibleHome())return;
      // Preserve an unfinished manual step entry. The next scheduled/manual sync retries.
      if(modalKind==='steps')return;
      apply(result.days);
      lastSync=new Date().toLocaleTimeString(state.language==='en'?'en-GB':'de-AT',{hour:'2-digit',minute:'2-digit'});
      if(manual)toast(Object.keys(result.days).length?text('Schritte synchronisiert.','Steps synchronized.'):text('Noch keine Schritte verfügbar.','No steps available yet.'));
    }catch(error){if(valid()){if(error.code==='health/permission-denied')granted=false;if(error.code==='steps/permission-denied')stepGranted=false;if(manual)toast(message(error));}}
    finally{if(valid()){busy=false;refresh();}}
  }
  function schedule(force=false){
    const home=visibleHome(),entered=home&&!wasHome;wasHome=home;
    if(!home){if(timer!==null)clearInterval(timer);timer=null;return;}
    if(timer===null)timer=setInterval(()=>{if(visibleHome())void run();},120000);
    if(entered||force)void run();
  }
  async function disconnect(){generation++;busy=false;lastSync='';localStorage.removeItem(key());refresh();await run();}
  async function stopCounting(){generation++;busy=false;lastSync='';localStorage.removeItem(countKey());await SetwerkNative.call('steps-stop');refresh();}
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-health]');if(!button||button.disabled)return;
    const action=button.dataset.health;
    if(action==='explain')openModal('Health Connect',`<p>${consent()}</p><p>${text('Deine Health-App muss Schritte in Health Connect schreiben dürfen. Auf unterstützten Geräten zählt Health Connect auch selbst.','Your health app must be allowed to write steps to Health Connect. On supported devices, Health Connect also counts steps itself.')}</p><div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn outline" data-action="close-modal">${text('Zurück','Back')}</button><button class="btn accent" data-health="connect">${text('Verbinden','Connect')}</button></div>`,'health');
    if(action==='count-explain')openModal(text('Schritte automatisch zählen','Count steps automatically'),`<p>${countConsent()}</p><div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn outline" data-action="close-modal">${text('Zurück','Back')}</button><button class="btn accent" data-health="count-connect">${text('Aktivieren','Enable')}</button></div>`,'health');
    if(action==='connect')void run('health-connect',true);
    if(action==='count-connect')void run('steps-connect',true);
    if(action==='sync')void run('status',true);
    if(action==='guest-settings')openModal(text('Kontodaten','Account details'),`<section class="account-section"><h3>${text('Schritte & Health Connect','Steps & Health Connect')}</h3><div data-step-settings>${controls(true)}</div></section>`,'step-settings');
    if(action==='disconnect')void disconnect().catch(error=>toast(message(error)));
    if(action==='count-stop')void stopCounting().catch(error=>toast(message(error)));
    if(action==='settings')void SetwerkNative.call('health-settings').catch(error=>toast(message(error)));
  });
  window.addEventListener('setwerk:account-details',event=>{
    const container=event.detail.dialog.querySelector('.account-sections');if(!container)return;
    const section=document.createElement('section');section.className='account-section';
    section.innerHTML=`<h3>${text('Schritte & Health Connect','Steps & Health Connect')}</h3><div data-step-settings></div>`;
    const sync=container.querySelector('.account-sync-status')?.closest('section');container.insertBefore(section,sync||null);refresh();
  });
  window.addEventListener('setwerk:render',()=>{refresh();schedule();});
  window.addEventListener('setwerk:resume',()=>schedule(true));
  document.addEventListener('visibilitychange',()=>schedule(!document.hidden));
  window.addEventListener('setwerk:account-state',event=>{if(event.detail.accountChanged){generation++;busy=false;lastSync='';void run();}});
  refresh();schedule();if(!visibleHome())void run();
  return {sync:()=>run('status',true),disconnect,stopCounting};
})();
