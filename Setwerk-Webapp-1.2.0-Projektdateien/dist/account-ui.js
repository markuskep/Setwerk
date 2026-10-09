/* Account menu and profile settings; credentials never enter application storage. */
export function createAccountUI(api){
  const t=(de,en)=>document.documentElement.lang==='en'?en:de;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let user=null,menu=null,trigger=null,dialog=null,busy=false,pendingPhoto='',imageJob=0;
  const cloud=()=>window.SetwerkCloud;
  const profile=()=>cloud()?.user?.id===user?.id&&cloud()?.profile?cloud().profile:{name:user?.name||'',photo:''};
  const photo=value=>typeof value==='string'&&value.length<=100000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)?value:'avatar-default.svg';
  function refresh(next=user){
    const changed=user?.id!==next?.id;user=next;
    if(changed){closeMenu(false);if(dialog?.open)dialog.close();++imageJob;}
    if(user)document.querySelectorAll('[data-action="toggle-language"]').forEach(button=>button.remove());
    for(const button of document.querySelectorAll('[data-auth-open]')){
      button.replaceChildren();
      if(user){
        const p=profile(),name=p.name||t('Mein Konto','My account');
        const img=document.createElement('img');img.className='account-avatar';img.alt='';img.src=photo(p.photo);img.onerror=()=>{img.onerror=null;img.src='avatar-default.svg';};button.append(img);
        const label=document.createElement('span');label.className='account-label';label.textContent=button.hasAttribute('data-auth-compact')?t('Konto','Account'):name;button.append(label);
        const arrow=document.createElement('span');arrow.className='account-chevron';arrow.textContent='⌃';arrow.setAttribute('aria-hidden','true');button.append(arrow);
        button.dataset.authState='signed-in';button.dataset.syncState=cloud()?.mode||'';
        button.setAttribute('aria-label',t('Konto von ','Account for ')+name);button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded',String(trigger===button&&!!menu));
        button.title=cloud()?.description()||name;
      }else{
        button.textContent=t('Anmelden','Sign in');button.title=button.textContent;
        button.setAttribute('aria-label',button.textContent);
        delete button.dataset.authState;delete button.dataset.syncState;
        button.removeAttribute('aria-haspopup');button.removeAttribute('aria-expanded');button.removeAttribute('aria-controls');
      }
    }
    if(menu&&!trigger?.isConnected)closeMenu(false);
    const info=dialog?.querySelector('.account-sync-status');if(info)info.textContent=cloud()?.description()||'';
  }
  function closeMenu(focus=true){
    menu?.remove();menu=null;
    if(trigger){trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-controls');if(focus&&trigger.isConnected)trigger.focus();}
    trigger=null;
  }
  function toggleMenu(button){
    if(!user)return;
    if(menu&&trigger===button){closeMenu();return;}
    closeMenu(false);trigger=button;
    menu=document.createElement('div');menu.className='account-menu';menu.id='account-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label',t('Konto','Account'));
    const options=[[t('Kontodaten','Account details'),()=>openDetails()], [t('Farben','Colors'),()=>openAppearance()], [t('Abmelden','Sign out'),()=>signOut()], [t('Konto löschen','Delete account'),()=>openDetails(true),'account-danger']];
    for(const [label,action,cls] of options){const item=document.createElement('button');item.type='button';item.textContent=label;item.className=cls||'';item.setAttribute('role','menuitem');item.tabIndex=-1;item.onclick=()=>{closeMenu(false);action();};menu.append(item);}
    (button.closest('.account-control')||button.parentElement).append(menu);
    button.setAttribute('aria-expanded','true');button.setAttribute('aria-controls',menu.id);menu.querySelector('button').focus();
  }
  function refreshAppearance(){
    const appearance=window.SetwerkAppearance;if(!appearance||!dialog?.querySelector('#appearance-options'))return;
    for(const button of dialog.querySelectorAll('[data-theme-choice]'))button.setAttribute('aria-pressed',String(button.dataset.themeChoice===appearance.theme));
    const messages={synced:t('Im Konto gespeichert.','Saved to your account.'),offline:t('Lokal gespeichert. Wird bei Verbindung mit deinem Konto synchronisiert.','Saved locally. Will sync with your account when connected.'),pending:t('Lokal gespeichert …','Saved locally …'),syncing:t('Wird im Konto gespeichert …','Saving to your account …'),loading:t('Farbauswahl wird geladen …','Loading color scheme …')};
    dialog.querySelector('#appearance-status').textContent=messages[appearance.mode]||'';
  }
  function openAppearance(){
    if(!user||!window.SetwerkAppearance)return;
    ensureDialog();
    const options=[['standard',t('Standard','Default')],['cherry','Cherry'],['orange',t('Orange','Orange')],['light-blue',t('Hellblau','Light Blue')],['black-white','Black & White']];
    dialog.innerHTML=`<div class="modal-head"><h2 id="account-title">${t('Farben','Colors')}</h2><button type="button" class="icon-btn" data-account-action="close" aria-label="${t('Schließen','Close')}">×</button></div><div class="modal-body"><p class="muted">${t('Wähle dein Farbschema. Die Vorschau wird sofort übernommen.','Choose your color scheme. The preview is applied immediately.')}</p><div id="appearance-options" class="theme-grid">${options.map(([id,label])=>`<button type="button" class="theme-choice" data-theme-choice="${id}" aria-pressed="false"><span class="theme-preview" data-preview="${id}" aria-hidden="true"><i></i><span><b></b><em></em><em></em></span></span><span class="theme-choice-label">${label}<span class="theme-selected" aria-hidden="true">✓</span></span></button>`).join('')}</div><p id="appearance-status" class="muted theme-status" role="status" aria-live="polite"></p></div>`;
    for(const button of dialog.querySelectorAll('[data-theme-choice]'))button.onclick=()=>{try{window.SetwerkAppearance.select(button.dataset.themeChoice);}catch{dialog.querySelector('#appearance-status').textContent=t('Die Auswahl konnte nicht gespeichert werden. Bitte erneut versuchen.','The selection could not be saved. Please try again.');}};
    refreshAppearance();if(!dialog.open)dialog.showModal();dialog.querySelector('[aria-pressed="true"]')?.focus();
  }
  window.addEventListener('setwerk:appearance-state',refreshAppearance);
  async function signOut(){
    if(busy)return;
    try{
      if(cloud()?.readState&&JSON.parse(cloud().readState()||'null')?.active){openDetails();showMessage(t('Bitte das laufende Training zuerst abschließen.','Please finish the current workout first.'),true);return;}
      await api.logout();api.activateUser(null);if(dialog?.open)dialog.close();
    }catch(error){openDetails();showMessage(api.authError(error),true);}
  }
  function showMessage(value,error=false){
    const node=dialog?.querySelector('#account-message');if(!node)return;node.textContent=value;node.classList.toggle('error',error);
  }
  function ensureDialog(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.id='account-details';dialog.setAttribute('aria-labelledby','account-title');document.body.append(dialog);
    dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
    dialog.addEventListener('close',()=>{++imageJob;dialog.querySelectorAll('input[type="password"]').forEach(input=>input.value='');const buttons=[...document.querySelectorAll('[data-auth-open]')];(buttons.find(button=>button.getClientRects().length)||buttons[0])?.focus();});
    dialog.addEventListener('click',event=>{
      const action=event.target.closest('[data-account-action]')?.dataset.accountAction;if(!action||busy)return;
      if(action==='close')dialog.close();
      if(action==='remove-photo'){pendingPhoto='';++imageJob;dialog.querySelector('#profile-preview').src='avatar-default.svg';dialog.querySelector('#profile-photo').value='';}
      if(action==='delete'){dialog.querySelector('#account-delete-section').hidden=false;dialog.querySelector('#delete-password').focus();dialog.querySelector('#account-delete-section').scrollIntoView?.({block:'nearest',behavior:'smooth'});}
      if(action==='sync-panel'){dialog.close();cloud()?.openPanel(()=>signOut());}
    });
    dialog.addEventListener('change',event=>{if(event.target.id==='profile-photo')choosePhoto(event.target);else if(event.target.id==='account-language')changeLanguage(event.target);});
    dialog.addEventListener('submit',event=>{event.preventDefault();if(!busy)submit(event.target);});
  }
  function openDetails(deletion=false){
    if(!user)return;
    ensureDialog();const p=profile();pendingPhoto=p.photo||'';++imageJob;
    dialog.innerHTML=`<div class="modal-head"><h2 id="account-title">${t('Kontodaten','Account details')}</h2><button type="button" class="icon-btn" data-account-action="close" aria-label="${t('Schließen','Close')}">×</button></div><div class="modal-body account-sections">
      <form id="profile-form" class="account-form"><div class="profile-photo-row"><img id="profile-preview" class="profile-preview" src="${escape(photo(pendingPhoto))}" alt="${t('Profilbild','Profile picture')}"><div class="profile-photo-controls"><label class="btn outline photo-picker">${t('Profilbild auswählen','Choose profile picture')}<input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-label="${t('Profilbild auswählen','Choose profile picture')}"></label><button type="button" class="btn ghost" data-account-action="remove-photo">${t('Bild entfernen','Remove picture')}</button></div></div><label>${t('E-Mail-Adresse','Email address')}<input type="email" value="${escape(user.email)}" readonly autocomplete="email"></label><label>${t('Nutzername','Username')}<input name="profileName" value="${escape(p.name)}" required maxlength="80" autocomplete="nickname" placeholder="${t('Dein Name','Your name')}"></label><button type="submit" class="btn accent">${t('Profil speichern','Save profile')}</button></form>
      <section class="account-section"><h3>${t('Sprache','Language')}</h3><label>${t('App-Sprache','App language')}<select id="account-language"><option value="de" ${document.documentElement.lang==='en'?'':'selected'}>Deutsch</option><option value="en" ${document.documentElement.lang==='en'?'selected':''}>English</option></select></label></section>
      <section class="account-section"><h3>${t('Passwort ändern','Change password')}</h3><form id="password-form" class="account-form"><input type="text" name="username" value="${escape(user.email)}" autocomplete="username" hidden><label>${t('Aktuelles Passwort','Current password')}<input name="currentPassword" type="password" required autocomplete="current-password"></label><label>${t('Neues Passwort','New password')}<input name="newPassword" type="password" required minlength="6" autocomplete="new-password"></label><label>${t('Neues Passwort wiederholen','Repeat new password')}<input name="repeatPassword" type="password" required minlength="6" autocomplete="new-password"></label><button type="submit" class="btn outline">${t('Passwort ändern','Change password')}</button></form></section>
      <section class="account-section"><h3>${t('Synchronisierung','Synchronization')}</h3><p class="account-sync-status muted">${escape(cloud()?.description()||'')}</p><button type="button" class="btn outline" data-account-action="sync-panel">${t('Synchronisierung & Datensicherung','Sync & backups')}</button></section>
      <section class="account-section"><button type="button" class="btn danger" data-account-action="delete">${t('Konto löschen','Delete account')}</button><div id="account-delete-section" ${deletion?'':'hidden'}><p class="account-delete-note">${t('Dein Konto, dein Profil und alle online gespeicherten Trainings und Vorlagen werden endgültig gelöscht. Erstelle bei Bedarf vorher eine Datensicherung.','Your account, profile and all workouts and templates saved online will be permanently deleted. Download a backup first if needed.')}</p><form id="delete-account-form" class="account-form"><input type="text" name="username" value="${escape(user.email)}" autocomplete="username" hidden><label>${t('Aktuelles Passwort','Current password')}<input id="delete-password" name="deletePassword" type="password" required autocomplete="current-password"></label><label class="inline-check"><input type="checkbox" name="confirmDeletion" required>${t('Ich möchte mein Konto endgültig löschen.','I want to permanently delete my account.')}</label><button type="submit" class="btn danger">${t('Konto endgültig löschen','Permanently delete account')}</button></form></div></section>
      <p id="account-message" class="auth-message" role="status" aria-live="polite"></p></div>`;
    if(!dialog.open)dialog.showModal();
    (deletion?dialog.querySelector('#delete-password'):dialog.querySelector('[name="profileName"]')).focus();
  }
  function changeLanguage(select){
    if(!user||busy)return;
    const previous=document.documentElement.lang==='en'?'en':'de',draftPhoto=pendingPhoto,deletion=!dialog.querySelector('#account-delete-section').hidden;
    const values=[...dialog.querySelectorAll('input:not([type="file"])')].map(input=>({value:input.value,checked:input.checked}));
    try{
      api.setLanguage(select.value);openDetails(deletion);pendingPhoto=draftPhoto;dialog.querySelector('#profile-preview').src=photo(pendingPhoto);
      [...dialog.querySelectorAll('input:not([type="file"])')].forEach((input,index)=>{input.value=values[index].value;input.checked=values[index].checked;});
      dialog.querySelector('#account-language').focus();showMessage(t('Sprache gespeichert.','Language saved.'));
    }catch(error){select.value=previous;showMessage(api.authError(error),true);}
  }
  async function choosePhoto(input){
    const file=input.files?.[0],job=++imageJob;if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){showMessage(t('Bitte ein JPG-, PNG- oder WebP-Bild bis 10 MB auswählen.','Please choose a JPG, PNG or WebP image up to 10 MB.'),true);input.value='';return;}
    busy=true;lock(true);showMessage(t('Bild wird vorbereitet …','Preparing picture …'));
    let url;
    try{
      url=URL.createObjectURL(file);const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error(t('Das Bild konnte nicht gelesen werden.','The image could not be read.')));image.src=url;});
      if(!dialog.open||job!==imageJob)return;
      const canvas=document.createElement('canvas');canvas.width=192;canvas.height=192;
      const side=Math.min(image.naturalWidth,image.naturalHeight);if(!side)throw Error(t('Ungültiges Bild.','Invalid image.'));
      const context=canvas.getContext('2d');context.fillStyle='#eef3e8';context.fillRect(0,0,192,192);context.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,192,192);
      const data=canvas.toDataURL('image/jpeg',.8);if(data.length>100000)throw Error(t('Das Bild ist zu groß. Bitte ein anderes Bild wählen.','The picture is too large. Please choose another image.'));
      pendingPhoto=data;dialog.querySelector('#profile-preview').src=data;showMessage(t('Zum Übernehmen „Profil speichern“ auswählen.','Choose “Save profile” to apply the picture.'));
    }catch(error){showMessage(error.message,true);}finally{if(url)URL.revokeObjectURL(url);busy=false;lock(false);input.value='';}
  }
  function lock(value){dialog.querySelectorAll('button,input,select').forEach(node=>{node.disabled=value;});}
  async function submit(form){
    if(!form.reportValidity())return;
    const data=new FormData(form),owner=user?.id;if(!owner)return;
    if(form.id==='password-form'&&data.get('newPassword')!==data.get('repeatPassword')){showMessage(t('Die neuen Passwörter stimmen nicht überein.','The new passwords do not match.'),true);return;}
    busy=true;lock(true);showMessage('');
    try{
      if(form.id==='profile-form'){
        const name=String(data.get('profileName')||'').trim();if(!name)throw Error(t('Bitte einen Nutzernamen eingeben.','Please enter a username.'));
        const updated=await api.updateUserProfile(name);if(user?.id!==owner)throw Error(t('Das Konto wurde gewechselt.','The account has changed.'));
        cloud().setProfile({name,photo:pendingPhoto});api.activateUser(updated);await cloud().sync();refresh();showMessage(t('Profil gespeichert.','Profile saved.')+' '+cloud().description());
      }else if(form.id==='password-form'){
        await api.changePassword(String(data.get('currentPassword')),String(data.get('newPassword')));form.reset();showMessage(t('Dein Passwort wurde geändert.','Your password has been changed.'));
      }else if(form.id==='delete-account-form'){
        await api.removeAccount(String(data.get('deletePassword')));api.activateUser(null);dialog.close();
      }
    }catch(error){showMessage(api.authError(error),true);}finally{busy=false;lock(false);form.querySelectorAll('input[type="password"]').forEach(input=>input.value='');}
  }
  document.addEventListener('click',event=>{if(menu&&!menu.contains(event.target)&&!trigger?.contains(event.target))closeMenu(false);});
  document.addEventListener('keydown',event=>{
    const opening=event.target.closest?.('[data-auth-open]');
    if(!menu&&opening?.dataset.authState==='signed-in'&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();toggleMenu(opening);if(event.key==='ArrowUp')menu?.lastElementChild.focus();return;}
    if(!menu)return;
    if(event.key==='Escape'){event.preventDefault();closeMenu();return;}
    if(event.key==='Tab'){closeMenu(false);return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();const items=[...menu.querySelectorAll('button')],index=items.indexOf(document.activeElement);
    items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();
  });
  return{refresh,toggleMenu,openDetails,closeMenu};
}
