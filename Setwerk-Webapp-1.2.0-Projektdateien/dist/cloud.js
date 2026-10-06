/* Per-account local storage; cloud requests only outside an active workout. */
'use strict';
window.SetwerkCloud=(()=>{
  const C=SetwerkCloudCore,G=GymCore,guestKey='setwerk.v1',prefix='setwerk.account.v1.',lastUserKey='setwerk.last-account.v1';
  let user=null,meta=null,current=G.fresh(),mode='guest',timer=null,inflight=null,epoch=0,remoteConflict=null,storageError=false,corruptRaw=null;
  const t=(de,en)=>document.documentElement.lang==='en'?en:de;
  const key=()=>user?prefix+user.id:guestKey;
  function readState(){if(storageError)throw Error('Local storage cannot be read');return user?JSON.stringify(current):localStorage.getItem(guestKey);}
  function persist(){if(storageError)throw Error('Local storage cannot be read');try{if(user)localStorage.setItem(key(),JSON.stringify(meta));else localStorage.setItem(guestKey,JSON.stringify(current));}catch(error){error.storage=true;throw error;}}
  function emitState(accountChanged=false){window.dispatchEvent(new CustomEvent('setwerk:account-state',{detail:{state:C.clone(current),accountChanged,storageError}}));}
  function status(next=mode){mode=next;const info=document.querySelector('#cloud-account .cloud-description');if(info)info.textContent=description();window.dispatchEvent(new CustomEvent('setwerk:cloud-status'));}
  function saveLocal(state){
    if(storageError)throw Error('Local storage cannot be read');
    const before=user?C.project(current):null,previous=current;
    current=C.clone(state);
    if(user){
      const previousMeta=C.clone(meta);
      meta.state=current;
      if(!C.equal(before,C.project(current)))meta.pending=true;
      try{persist();}catch(error){current=previous;meta=previousMeta;throw error;}
      if(meta.pending)status('pending');
      schedule();
    }else{try{persist();}catch(error){current=previous;throw error;}}
  }
  function schedule(){
    clearTimeout(timer);
    if(storageError||!user||!meta.pending||current.active||remoteConflict||navigator.onLine===false)return;
    timer=setTimeout(()=>sync(),900);
  }
  async function request(method,body){
    const response=await fetch('/.netlify/functions/workout-store',{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
    let data;try{data=await response.json();}catch{throw Error('unavailable');}
    if(!response.ok){const error=Error(data.error||'unavailable');error.status=response.status;throw error;}
    if(data.data)C.validate(data.data);
    if(!Number.isSafeInteger(data.revision)||data.revision<0)throw Error('unavailable');
    return data;
  }
  function applyRemote(data){
    // Running workout and drafts remain local, including after a reload.
    current={...current,...C.clone(data)};
    meta.state=current;
    persist();emitState();
  }
  async function connect(nextUser){
    ++epoch;clearTimeout(timer);inflight=null;remoteConflict=null;storageError=false;corruptRaw=null;user=nextUser?.id?{id:nextUser.id,email:nextUser.email}:null;
    meta=null;
    try{
      if(user)localStorage.setItem(lastUserKey,JSON.stringify(user));else localStorage.removeItem(lastUserKey);
      const raw=localStorage.getItem(key());corruptRaw=raw;
      if(!user){current=G.migrateState(JSON.parse(raw||JSON.stringify(G.fresh())));C.validate(C.project(current));corruptRaw=null;status('guest');emitState(true);return;}
      meta=raw?JSON.parse(raw):{state:G.fresh(),base:C.project(G.fresh()),revision:0,pending:false};
      if(!meta.state||!meta.base||!Number.isSafeInteger(meta.revision)||meta.revision<0||typeof meta.pending!=='boolean')throw Error('Invalid local account data');
      current=G.migrateState(meta.state);C.validate(C.project(current));C.validate(meta.base);meta.state=current;corruptRaw=null;
    }catch{storageError=true;current=G.fresh();status('storage-error');emitState(true);return;}
    status(meta.pending?'pending':'loading');emitState(true);
    if(!current.active)await sync();else status(meta.pending?'pending':'local');
  }
  async function sync(){
    if(storageError){status('storage-error');return;}
    if(!user||current.active){if(user)status('local');return;}
    if(navigator.onLine===false){status('offline');return;}
    if(inflight){schedule();return inflight;}
    if(remoteConflict){status('conflict');return;}
    const token=epoch,owner=user.id;
    status('syncing');
    const job=(async()=>{
      try{
        const remote=await request('GET');
        if(token!==epoch||owner!==user?.id)return;
        if(current.active){status('local');return;}
        const remoteData=remote.data||C.project(G.fresh());
        const merged=meta.pending?C.merge(meta.base,C.project(current),remoteData):{data:remoteData,conflicts:[]};
        if(merged.conflicts.length){remoteConflict=remote;status('conflict');return;}
        const snapshot=merged.data, localAtStart=C.project(current);
        if(!C.equal(snapshot,remoteData)){
          const result=await request('POST',{revision:remote.revision,data:snapshot});
          if(token!==epoch||owner!==user?.id)return;
          meta.revision=result.revision;
        }else meta.revision=remote.revision;
        // Include edits made while the request was in flight without losing them.
        const after=C.merge(localAtStart,C.project(current),snapshot);
        if(after.conflicts.length){remoteConflict={data:snapshot,revision:meta.revision};status('conflict');return;}
        meta.base=C.clone(snapshot);meta.pending=!C.equal(after.data,snapshot);
        applyRemote(after.data);status(current.active?'local':meta.pending?'pending':'synced');
      }catch(error){
        if(token!==epoch)return;
        status(error.storage?'storage-error':error.status===503?'unconfigured':error.status===401?'sign-in':error.status===409?'pending':error.status===413?'too-large':'offline');
      }
    })();
    inflight=job;
    try{await job;}finally{if(inflight===job)inflight=null;}
  }
  function description(){
    const labels={guest:t('Auf diesem Gerät','On this device'),loading:t('Online-Daten werden geladen …','Loading cloud data …'),syncing:t('Wird synchronisiert …','Syncing …'),synced:t('Online gespeichert','Saved online'),pending:t('Lokal gespeichert · Upload ausstehend','Saved locally · upload pending'),offline:t('Lokal gespeichert · Verbindung fehlt','Saved locally · connection unavailable'),unconfigured:t('Online-Speicher noch nicht eingerichtet','Cloud storage is not configured yet'),local:t('Training läuft lokal','Workout is running locally'),conflict:t('Änderungen auf zwei Geräten · Auswahl erforderlich','Changes on two devices · choose a version'), 'sign-in':t('Lokal gespeichert · bitte erneut anmelden','Saved locally · please sign in again'),'too-large':t('Lokal gespeichert · Online-Speichergrenze erreicht','Saved locally · cloud storage limit reached')};
    return mode==='storage-error'?t('Lokaler Speicher konnte nicht gelesen oder geschrieben werden.','Local storage could not be read or written.'):labels[mode]||labels.pending;
  }
  function downloadBackup(data=current){
    const blob=new Blob([corruptRaw||JSON.stringify({format:'setwerk-backup-v1',data},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='Setwerk-Backup-'+G.localDate()+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function importGuest(){
    if(!user||current.active)return;
    const raw=localStorage.getItem(guestKey);if(!raw)return;
    const guest=G.migrateState(JSON.parse(raw));
    if(guest.active)throw Error(t('Bitte das lokale Training zuerst abschließen.','Please finish the guest workout first.'));
    const next=C.clone(current);
    for(const name of ['customExercises','templates','sessions']){
      const map=new Map(next[name].map(r=>[r.id,r]));
      for(const record of guest[name]){
        if(!map.has(record.id)){next[name].push(C.clone(record));map.set(record.id,record);}
        else if(!C.equal(record,map.get(record.id)))throw Error(t('Ein Eintrag wurde bereits unterschiedlich übernommen. Bitte einzeln über Workout importieren übernehmen.','An imported record has changed. Please import it separately using Workout import.'));
      }
    }
    saveLocal(next);emitState();return sync();
  }
  function useCloudVersion(){
    if(!remoteConflict||current.active)return;
    // Preserve a recoverable local backup before replacing any conflicting data.
    localStorage.setItem(key()+'.conflict-backup',JSON.stringify(current));
    downloadBackup();
    meta.base=remoteConflict.data||C.project(G.fresh());meta.revision=remoteConflict.revision;meta.pending=false;
    applyRemote(meta.base);remoteConflict=null;status('synced');
  }
  async function useLocalVersion(){
    if(!remoteConflict||current.active||storageError)return;
    const remote=remoteConflict.data||C.project(G.fresh());
    // Keep independently created records from both devices, choosing local only
    // for the conflicting records. The next write still checks the revision.
    const resolved=C.merge(meta.base,C.project(current),remote).data;
    localStorage.setItem(key()+'.cloud-conflict-backup',JSON.stringify(remote));
    downloadBackup(remote);
    meta.base=C.clone(remote);meta.revision=remoteConflict.revision;meta.pending=true;
    applyRemote(resolved);remoteConflict=null;await sync();
  }
  async function restoreBackup(file){
    if(!file||!user||current.active||storageError)return;
    if(file.size>2*1024*1024)throw Error(t('Die Sicherung ist zu groß.','The backup is too large.'));
    const backup=JSON.parse(await file.text());
    if(backup.format!=='setwerk-backup-v1'||!backup.data)throw Error(t('Ungültige Setwerk-Sicherung.','Invalid Setwerk backup.'));
    const imported=C.project(backup.data);C.validate(imported);
    const next=C.clone(current);
    for(const name of ['customExercises','templates','sessions']){
      const ids=new Set(next[name].map(record=>record.id));
      for(const record of imported[name]){
        if(ids.has(record.id)){if(!C.equal(next[name].find(r=>r.id===record.id),record))throw Error(t('Ein Eintrag mit derselben ID wurde geändert. Bitte über Workout importieren einzeln übernehmen.','A record with the same ID has changed. Please import it individually using Workout import.'));}
        else{next[name].push(record);ids.add(record.id);}
      }
    }
    saveLocal(next);emitState();await sync();
  }
  function openPanel(onLogout){
    let dialog=document.getElementById('cloud-account');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='cloud-account';dialog.setAttribute('aria-label',t('Konto & Synchronisierung','Account & sync'));document.body.append(dialog);}
    dialog.innerHTML='';
    const heading=document.createElement('h2');heading.textContent=t('Konto & Synchronisierung','Account & sync');dialog.append(heading);
    const email=document.createElement('p');email.textContent=user?.email||'';dialog.append(email);
    const info=document.createElement('p');info.className='cloud-description';info.textContent=description();dialog.append(info);
    const note=document.createElement('p');note.className='muted';note.textContent=t('Workouts laufen lokal und werden nach dem Abschluss übertragen.','Workouts run locally and upload after completion.');dialog.append(note);
    const buttons=document.createElement('div');buttons.className='cloud-actions';dialog.append(buttons);
    const add=(label,action,disabled=false)=>{const button=document.createElement('button');button.type='button';button.className='btn outline';button.textContent=label;button.disabled=disabled;button.onclick=async()=>{try{await action();info.textContent=description();}catch(error){info.textContent=error.message;}};buttons.append(button);};
    add(t('Jetzt synchronisieren','Sync now'),sync,!!current.active);
    add(t('Lokale Trainings in dieses Konto übernehmen','Import guest workouts into this account'),importGuest,!!current.active);
    add(t('Datensicherung herunterladen','Download backup'),()=>downloadBackup());
    const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;dialog.append(file);
    file.onchange=async()=>{try{await restoreBackup(file.files?.[0]);info.textContent=description();}catch(error){info.textContent=error.message;}file.value='';};
    add(t('Sicherung importieren','Import backup'),()=>file.click(),!!current.active||storageError);
    if(remoteConflict){
      add(t('Lokale Sicherung erstellen & Online-Version laden','Back up local data & load cloud version'),useCloudVersion);
      add(t('Online-Sicherung erstellen & lokale Änderungen übernehmen','Back up cloud data & keep local changes'),useLocalVersion);
    }
    add(t('Abmelden','Sign out'),async()=>{await onLogout();dialog.close();},!!current.active);
    add(t('Schließen','Close'),()=>dialog.close());
    if(!dialog.open)dialog.showModal();
  }
  window.addEventListener('online',()=>{if(user&&!current.active)sync();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&user&&!current.active)sync();});
  // Reopen the last signed-in local account without requiring a network request.
  // The server always verifies Identity separately before serving cloud data.
  try{
    const remembered=JSON.parse(localStorage.getItem(lastUserKey)||'null');
    if(remembered?.id&&/^[A-Za-z0-9_-]{1,100}$/.test(remembered.id)){
      user=remembered;corruptRaw=localStorage.getItem(key());
      meta=corruptRaw?JSON.parse(corruptRaw):{state:G.fresh(),base:C.project(G.fresh()),revision:0,pending:false};
      if(!meta.state||!meta.base||!Number.isSafeInteger(meta.revision)||meta.revision<0||typeof meta.pending!=='boolean')throw Error('Invalid cache');
      current=G.migrateState(meta.state);C.validate(C.project(current));C.validate(meta.base);corruptRaw=null;status(current.active?'local':meta.pending?'pending':'loading');
    }
  }catch{storageError=true;current=G.fresh();status('storage-error');}
  return {readState,saveLocal,connect,sync,description,openPanel,downloadBackup,importGuest,useCloudVersion,useLocalVersion,restoreBackup,get user(){return user;},get mode(){return mode;},get storageError(){return storageError;}};
})();
