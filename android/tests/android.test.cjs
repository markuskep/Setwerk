const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'../assets'),G=require('../assets/core.js');
const finished=id=>({id,name:'Training',category:'Kraft',date:'2026-10-06',duration:600,items:[]});
const settle=()=>new Promise(r=>setImmediate(r));
function setup(persisted=new Map(),existing=G.fresh()){
 const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://appassets.androidplatform.net/assets/index.html',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[],site='https://setwerk-cb1e0.web.app';let remote={revision:0,data:null},offline=false,deleteFailure=false,user={id:'alice',email:'alice@example.test',name:'Alice'},legacy=null;
 w.TextEncoder=TextEncoder;w.scrollTo=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.fetch=async()=>{throw Error('Cloud must use native transport');};
 const storageKey=key=>key==='setwerk.v1'?key:site+'|'+key;
 if(!persisted.has('setwerk.v1'))persisted.set('setwerk.v1',JSON.stringify(existing));
 w.AndroidGym={readState:()=>{throw Error('Guest bridge must not bypass account storage');},writeState:()=>{throw Error('Account must not overwrite guest storage');},
  storageGet:key=>persisted.get(storageKey(key))??null,storageSet:(key,value)=>{persisted.set(storageKey(key),value);return true;},storageRemove:key=>{persisted.delete(storageKey(key));return true;},
  getSite:()=>site,accountSettings:()=>{},scheduleRest:()=>{},cancelRest:()=>{},setReminders:()=>{},
  request:(id,operation,raw)=>{
   const body=JSON.parse(raw);calls.push({operation,body});let status=200,data={};
   if(offline){status=502;data={code:'auth/network-request-failed'};}
   else if(operation==='cloud-read')data=remote;
   else if(operation==='cloud-write'){if(body.revision!==remote.revision){status=409;data={code:'setwerk/conflict'};}else{remote={revision:remote.revision+1,data:body.data};data={revision:remote.revision,data:null};}}
   else if(operation==='identity-user')data={user};
   else if(operation==='identity-login'||operation==='identity-signup'){user={id:'alice',email:body.email,name:body.name||'Alice'};data=user;}
   else if(operation==='identity-profile'){user={...user,name:body.name};data=user;}
   else if(operation==='identity-logout')user=null;
   else if(operation==='identity-reauth'){if(body.password==='wrong'){status=400;data={code:'auth/invalid-credential'};}else data=user;}
   else if(operation==='cloud-erase'){data={previous:remote.data?remote:null};if(remote.data)remote={revision:remote.revision+1,data:{deleted:true}};}
   else if(operation==='cloud-restore'){remote={revision:remote.revision+1,data:body.data};data={revision:remote.revision,data:null};}
   else if(operation==='identity-delete'){if(deleteFailure){status=502;data={code:'auth/network-request-failed'};}else user=null;}
   else if(operation==='legacy-list')data={accounts:legacy?[{id:'old',email:'previous@example.test',sessions:legacy.sessions.length,templates:legacy.templates.length}]:[]};
   else if(operation==='legacy-read')data={state:legacy};
   w.queueMicrotask(()=>w.SetwerkNative.receive(id,status,JSON.stringify(data)));
  }
 };
 for(const file of ['android-bridge.js','core.js','cloud-core.js','cloud.js','exercises.js','exercises-en.js','i18n.js','transfer.js','app.js','android-legacy.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
 w.eval('(function(){'+fs.readFileSync(path.join(root,'firebase-service.js'),'utf8').replace(/^export /gm,'')+';window.NativeFirebase={login,signup,logout,getUser,subscribeAuth,resetPassword,updateUserProfile,changePassword,removeAccount};})()');
 const account=id=>JSON.parse(persisted.get(site+'|setwerk.firebase.account.v1.'+id)||'null');
 return {dom,w,calls,cloud:w.SetwerkCloud,persisted,account,remote:()=>remote,setRemote:r=>{remote=r;},setOffline:value=>{offline=value;},setDeleteFailure:v=>{deleteFailure=v;},setLegacy:v=>{legacy=v;},loadAuth:()=>{
  w.eval(fs.readFileSync(path.join(root,'account-ui.js'),'utf8').replace('export function createAccountUI','window.createAccountUI=function createAccountUI'));
  w.eval('const {signup,login,logout,getUser,subscribeAuth,resetPassword,updateUserProfile,changePassword,removeAccount}=window.NativeFirebase;\n'+fs.readFileSync(path.join(root,'auth.js'),'utf8').replace(/^import[^\n]+\n/gm,''));
 }};
}
test('Android update preserves guest records until explicit Firebase account import',async()=>{
 const guest=G.fresh();guest.sessions=[finished('old-phone')];const x=setup(new Map(),guest);
 try{await x.cloud.connect({id:'alice'});assert.equal(x.account('alice').state.sessions.length,0);await x.cloud.importGuest();assert.equal(x.remote().data.sessions[0].id,'old-phone');assert.equal(JSON.parse(x.persisted.get('setwerk.v1')).sessions.length,1);}finally{x.dom.window.close();}
});
test('active Android workout stays local and completion uploads through native Firebase',async()=>{
 const x=setup();try{await x.cloud.connect({id:'alice'});x.calls.length=0;const state=x.account('alice').state;state.active=G.spontaneous();x.cloud.saveLocal(state);await x.cloud.sync();assert.equal(x.calls.length,0);
 state.active=null;state.sessions.push(finished('phone'));x.cloud.saveLocal(state);await x.cloud.sync();assert.deepEqual(x.calls.map(c=>c.operation),['cloud-read','cloud-write']);assert.equal(x.remote().data.sessions[0].id,'phone');assert.equal(x.remote().data.active,undefined);assert.equal(x.account('alice').pending,false);
 }finally{x.dom.window.close();}
});
test('Android account changes render the correct state and isolate guest and other accounts',async()=>{
 const x=setup();try{await x.cloud.connect({id:'alice'});x.w.document.querySelector('[data-action="start-select"]').click();x.w.document.querySelector('[data-action="start-spontaneous"]').click();assert.ok(x.account('alice').state.active);assert.equal(JSON.parse(x.persisted.get('setwerk.v1')).active,null);await x.cloud.connect({id:'bob'});assert.equal(x.account('bob').state.active,null);assert.ok(x.account('alice').state.active.spontaneous);
 }finally{x.dom.window.close();}
});
test('offline completed Android workouts survive reopening and upload on reconnection',async()=>{
 const x=setup();let y;try{await x.cloud.connect({id:'alice'});x.setOffline(true);const state=x.account('alice').state;state.sessions.push(finished('offline-phone'));x.cloud.saveLocal(state);await x.cloud.sync();assert.equal(x.cloud.mode,'offline');assert.equal(x.account('alice').pending,true);
 y=setup(x.persisted);assert.equal(y.cloud.user.id,'alice');assert.equal(y.account('alice').state.sessions.length,1);await y.cloud.connect({id:'alice'});assert.equal(y.remote().data.sessions[0].id,'offline-phone');assert.equal(y.account('alice').pending,false);
 }finally{x.dom.window.close();y?.dom.window.close();}
});
test('Android Firebase login opens the full account menu without persisting passwords',async()=>{
 const x=setup();try{x.loadAuth();await settle();x.w.document.querySelector('[data-auth-open]').click();assert.ok(x.w.document.querySelector('#account-menu'));x.w.document.querySelector('[data-auth-open]').click();await x.w.NativeFirebase.logout();
 x.w.document.querySelector('[data-auth-open]').click();const form=x.w.document.querySelector('#auth-form');form.elements.email.value='alice@example.test';form.elements.password.value='test-password';form.dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(x.cloud.user.id,'alice');assert.equal(x.w.document.querySelector('#auth-gate').hidden,true);assert.equal(form.elements.password.value,'');assert.ok([...x.persisted.values()].every(s=>!s.includes('test-password')));
 x.w.document.querySelector('[data-auth-open]').click();const menu=x.w.document.querySelector('#account-menu');assert.match(menu.textContent,/Kontodaten/);menu.querySelector('button').click();assert.ok(x.w.document.querySelector('#account-details').open);assert.ok(x.w.document.querySelector('#profile-form'));assert.ok(x.w.document.querySelector('#password-form'));assert.ok(x.w.document.querySelector('#delete-account-form'));
 }finally{x.dom.window.close();}
});
test('native resume pulls web changes and retains active Android workouts',async()=>{
 const x=setup();try{await x.cloud.connect({id:'alice'});x.calls.length=0;x.w.dispatchEvent(new x.w.Event('setwerk:resume'));await settle();assert.ok(x.calls.some(c=>c.operation==='cloud-read'));const state=x.account('alice').state;state.active=G.spontaneous();x.cloud.saveLocal(state);x.calls.length=0;x.w.dispatchEvent(new x.w.Event('setwerk:resume'));await settle();assert.equal(x.calls.filter(c=>c.operation.startsWith('cloud-')).length,0);
 }finally{x.dom.window.close();}
});
test('Android sport editors hide irrelevant fields and retain the new cardio parameters',async()=>{
 const x=setup();try{const q=s=>x.w.document.querySelector(s),click=n=>q('[data-action="'+n+'"]').click(),input=(s,v)=>{q(s).value=String(v);q(s).dispatchEvent(new x.w.Event('input',{bubbles:true}));q(s).dispatchEvent(new x.w.Event('change',{bubbles:true}));};
 click('new-template');input('#draft-name','Schwimmintervalle');input('[data-draft=category]','Ausdauer');input('[data-cardio=mode]','interval');input('[data-cardio=type]','Schwimmen');assert.equal(q('[data-action=pick-exercise]'),null);assert.equal(q('[data-cardio=elevationM]'),null);input('[data-cardio=count]',8);input('[data-cardio=workSeconds]',120);input('[data-cardio=restSeconds]',30);assert.equal(q('[data-draft=durationMinutes]').value,'19.5');q('#editor-form').dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));const saved=JSON.parse(x.persisted.get('setwerk.v1'));assert.equal(saved.templates[0].cardio.mode,'interval');assert.equal(saved.templates[0].items.length,0);
 q('[data-action=nav][data-route=calendar]').click();assert.equal(q('[data-action=import-workout]'),null);
 }finally{x.dom.window.close();}
});
test('legacy Android account import is explicit, preserves originals and resumes unfinished work',async()=>{
 const x=setup();try{await x.cloud.connect({id:'alice'});const legacy=G.fresh();legacy.sessions=[finished('legacy-phone')];legacy.active=G.spontaneous();legacy.active.items=[G.item({id:'bodyweight',name:'Liegestütz',kind:'reps'})];x.setLegacy(legacy);
 assert.equal(x.account('alice').state.sessions.length,0);x.cloud.openPanel(()=>{});await settle();x.w.document.querySelector('.legacy-recovery button').click();await settle();assert.equal(x.account('alice').state.sessions[0].id,'legacy-phone');assert.ok(x.account('alice').state.active);assert.equal(x.remote().data.active,undefined);assert.equal(legacy.sessions.length,1);assert.ok(x.w.document.querySelector('#focus-primary'));
 }finally{x.dom.window.close();}
});
test('wrong password blocks native account deletion before removing any data',async()=>{
 const x=setup();try{await x.w.NativeFirebase.login('alice@example.test','correct');await x.cloud.connect({id:'alice'});x.calls.length=0;await assert.rejects(x.w.NativeFirebase.removeAccount('wrong'),e=>e.code==='auth/invalid-credential');assert.deepEqual(x.calls.map(c=>c.operation),['identity-reauth']);
 }finally{x.dom.window.close();}
});
test('failed Firebase credential deletion restores the cloud snapshot and keeps local records',async()=>{
 const x=setup();try{await x.w.NativeFirebase.login('alice@example.test','correct');await x.cloud.connect({id:'alice'});const state=x.account('alice').state;state.sessions=[finished('preserved')];x.cloud.saveLocal(state);await x.cloud.sync();x.setDeleteFailure(true);x.calls.length=0;
 await assert.rejects(x.w.NativeFirebase.removeAccount('correct'));assert.deepEqual(x.calls.map(c=>c.operation),['identity-reauth','cloud-erase','identity-delete','cloud-restore']);assert.equal(x.remote().data.sessions[0].id,'preserved');assert.equal(x.account('alice').state.sessions.length,1);
 }finally{x.dom.window.close();}
});
test('successful Firebase account deletion forgets only that account and preserves guest records',async()=>{
 const guest=G.fresh();guest.sessions=[finished('guest')];const x=setup(new Map(),guest);try{x.loadAuth();await settle();await x.w.NativeFirebase.removeAccount('correct');assert.equal(x.cloud.user,null);assert.equal(x.account('alice'),null);assert.equal(JSON.parse(x.persisted.get('setwerk.v1')).sessions[0].id,'guest');
 }finally{x.dom.window.close();}
});
