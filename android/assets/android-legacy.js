/* Explicit recovery of records from the former Netlify account namespace. */
'use strict';
(()=>{
  const cloud=window.SetwerkCloud,open=cloud.openPanel;
  const t=(de,en)=>document.documentElement.lang==='en'?en:de;
  cloud.openPanel=function(...args){
    open.apply(cloud,args);
    const dialog=document.getElementById('cloud-account');
    window.SetwerkNative.call('legacy-list').then(({accounts})=>{
      if(!dialog.open||!accounts.length||dialog.querySelector('.legacy-recovery'))return;
      const section=document.createElement('section');section.className='legacy-recovery account-section';
      const heading=document.createElement('h3');heading.textContent=t('Trainings aus früheren Android-Versionen','Workouts from previous Android versions');section.append(heading);
      const note=document.createElement('p');note.className='muted';note.textContent=t('Diese Daten liegen noch auf deinem Gerät. Wähle aus, welche du in das aktuell angemeldete Konto übernehmen möchtest. Die ursprüngliche Sicherung bleibt erhalten.','These records are still on your device. Choose which to import into the account currently signed in. The original backup is retained.');section.append(note);
      for(const [i,account] of accounts.entries()){
        const button=document.createElement('button');button.className='btn outline';button.type='button';
        button.textContent=(account.email||t('Früheres Konto ','Previous account ')+(i+1))+' · '+account.sessions+' '+t('Trainings','workouts')+' · '+account.templates+' '+t('Vorlagen','templates');
        button.disabled=!!JSON.parse(cloud.readState()||'null')?.active;
        button.onclick=async()=>{
          button.disabled=true;const owner=cloud.user?.id;
          try{
            if(!owner)throw Error(t('Bitte zuerst anmelden.','Please sign in first.'));
            const before=JSON.parse(cloud.readState());if(before.active||before.draft)throw Error(t('Bitte das aktuelle Training oder den Entwurf zuerst abschließen.','Please finish the current workout or draft first.'));
            const {state}=await window.SetwerkNative.call('legacy-read',{id:account.id});
            const migrated=GymCore.migrateState(state);
            if(migrated.active){if(GymCore.isActivity(migrated.active))GymCore.validateActivity(migrated.active);else GymCore.validateItems(migrated.active.items);}
            const raw=JSON.stringify({format:'setwerk-backup-v1',data:migrated});
            if(cloud.user?.id!==owner)throw Error(t('Das Konto wurde gewechselt.','The account has changed.'));
            await cloud.restoreBackup({size:new TextEncoder().encode(raw).length,text:async()=>raw});
            if(cloud.user?.id!==owner)throw Error(t('Das Konto wurde gewechselt.','The account has changed.'));
            const next=JSON.parse(cloud.readState());
            if(migrated.active||migrated.draft){next.active=migrated.active||null;next.draft=migrated.draft||null;cloud.saveLocal(next);window.dispatchEvent(new CustomEvent('setwerk:account-state',{detail:{state:next,accountChanged:true,storageError:false}}));}
            dialog.querySelector('.cloud-description').textContent=t('Frühere Trainings übernommen. ','Previous workouts imported. ')+cloud.description();
            if(migrated.active||migrated.draft)dialog.close();
          }catch(error){dialog.querySelector('.cloud-description').textContent=error.message;}finally{button.disabled=false;}
        };
        section.append(button);
      }
      dialog.querySelector('.cloud-actions').before(section);
    }).catch(()=>{});
  };
})();
