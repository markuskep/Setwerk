/* Local-time welcome and an account-specific, temporary preview clock. */
window.SetwerkGreeting=(()=>{
  const previewEmail='markusk302@gmail.com';
  const periods=[
    [4,7,'Guten Morgen','Der frühe Vogel fängt den Wurm','Good morning','The early bird catches the worm'],
    [7,9,'Guten Morgen','Perfekter Zeitpunkt für ein Workout','Good morning','The perfect time for a workout'],
    [9,11,'Hallo','Wünsche einen schönen Vormittag','Hello','Wishing you a lovely morning'],
    [11,13,'Hallo','Schon Mittaggegessen?','Hello','Have you had lunch yet?'],
    [13,17,'Schönen Nachmittag','Vergiss nicht, auch mal Pausen einzulegen','Good afternoon','Remember to take a break now and then'],
    [17,20,'Schönen Abend','Wie war dein Tag heute?','Good evening','How was your day today?'],
    [20,22,'Schönen Abend','Spätes Workout oder früh ins Bett gehen?','Good evening','A late workout or an early night?'],
    [1,4,'Hi','Es gibt keinen schlechten Zeitpunkt für Sport','Hi','There is no bad time for exercise']
  ];
  const night=[22,1,'Gute Nacht','Morgen nichts vor oder schlaflose Nacht?','Good night','Nothing planned tomorrow or a sleepless night?'];
  let user=null,previewMinutes=null,dialog=null,returnFocus=null;
  const t=(de,en)=>document.documentElement.lang==='en'?en:de;
  const allowed=()=>!!user?.id&&String(user.email||'').trim().toLowerCase()===previewEmail;
  const localMinutes=()=>{const now=new Date();return now.getHours()*60+now.getMinutes();};
  const clockText=minutes=>String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
  function words(){
    const hour=(previewMinutes??localMinutes())/60;
    const period=periods.find(([start,end])=>hour>=start&&hour<end)||night;
    const cloud=window.SetwerkCloud;
    const name=user?.id?String((cloud?.user?.id===user.id?cloud.profile?.name:'')||user.name||'').trim():'';
    return{small:t(period[2],period[4])+(name?' '+name:''),large:t(period[3],period[5])};
  }
  function update(){
    const header=document.querySelector('[data-welcome]');if(!header)return;
    const greeting=words();header.querySelector('[data-welcome-greeting]').textContent=greeting.small;
    header.querySelector('[data-welcome-message]').textContent=greeting.large;
    let button=header.querySelector('[data-greeting-clock]');
    if(!allowed()){button?.remove();return;}
    if(!button){
      button=document.createElement('button');button.type='button';button.className='btn outline greeting-clock-button';button.dataset.greetingClock='';
      button.addEventListener('click',openClock);header.querySelector('.head-actions').append(button);
    }
    button.textContent=previewMinutes===null?t('Grußzeit testen','Test greeting time'):t('Grußzeit: ','Greeting time: ')+clockText(previewMinutes);
    button.setAttribute('aria-pressed',String(previewMinutes!==null));
  }
  function connect(next){
    if(user?.id!==next?.id||String(user?.email||'').toLowerCase()!==String(next?.email||'').toLowerCase()){
      previewMinutes=null;if(dialog?.open)dialog.close();
    }
    user=next?.id?next:null;update();
  }
  function closeClock(){if(dialog?.open)dialog.close();}
  function openClock(){
    if(!allowed())return;
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='greeting-clock';dialog.setAttribute('aria-labelledby','greeting-clock-title');document.body.append(dialog);
      dialog.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus();returnFocus=null;});
      dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-greeting-close]'))closeClock();});
      dialog.addEventListener('submit',event=>{
        event.preventDefault();if(!allowed())return closeClock();
        const input=dialog.querySelector('input');if(!input.reportValidity()||!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.value))return;
        const [hour,minute]=input.value.split(':').map(Number);previewMinutes=hour*60+minute;update();closeClock();
      });
      dialog.addEventListener('click',event=>{if(event.target.closest('[data-greeting-reset]')&&allowed()){previewMinutes=null;update();closeClock();}});
    }
    dialog.innerHTML=`<div class="modal-head"><h2 id="greeting-clock-title">${t('Grußzeit testen','Test greeting time')}</h2><button type="button" class="icon-btn" data-greeting-close aria-label="${t('Schließen','Close')}">×</button></div><div class="modal-body"><p class="muted">${t('Wähle eine Uhrzeit für die Begrüßung. Trainingszeiten und Erinnerungen bleiben unverändert.','Choose a time for the greeting. Workout times and reminders stay unchanged.')}</p><form class="inline-form"><label>${t('Uhrzeit','Time')}<input type="time" name="greetingTime" value="${clockText(previewMinutes??localMinutes())}" required step="60"></label><div class="modal-actions"><button class="btn accent" type="submit">${t('Vorschau anzeigen','Show preview')}</button><button class="btn outline" type="button" data-greeting-reset>${t('Echte Uhrzeit verwenden','Use current time')}</button></div></form></div>`;
    returnFocus=document.activeElement;dialog.showModal();dialog.querySelector('input').focus();
  }
  window.addEventListener('setwerk:render',update);
  window.addEventListener('setwerk:account-state',update);
  window.addEventListener('setwerk:cloud-status',update);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')update();});
  function nextMinute(){setTimeout(()=>{update();nextMinute();},60000-Date.now()%60000);}
  nextMinute();update();
  return{connect};
})();
