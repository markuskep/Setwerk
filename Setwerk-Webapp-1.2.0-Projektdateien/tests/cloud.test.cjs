const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const G=require('../dist/core.js'),C=require('../dist/cloud-core.js'),root=path.join(__dirname,'../dist');
const session=(id='finished')=>({id,name:'Training',category:'Kraft',date:'2026-10-06',duration:600,items:[]});
const template=(id='plan')=>({id,name:'Plan',category:'Kraft',items:[G.item({id:'exercise',name:'Squat',kind:'reps'})]});
function setup(stored={}){
 const dom=new JSDOM('<html lang="de"><body><div id="app"></div><dialog id="modal"></dialog><div id="toast"></div></body></html>',{url:'https://setwerk.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,calls=[];
 w.scrollTo=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 for(const [key,value] of Object.entries(stored))w.localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value));
 let remote={revision:0,data:null};w.fetch=async(url,options)=>{calls.push({url,method:options.method,body:options.body&&JSON.parse(options.body)});if(options.method==='POST'){remote={revision:remote.revision+1,data:JSON.parse(options.body).data};return{ok:true,json:async()=>({revision:remote.revision,data:null})};}return{ok:true,json:async()=>remote};};
 for(const file of ['core.js','cloud-core.js','cloud.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
 const account=()=>JSON.parse(w.localStorage.getItem('setwerk.account.v1.'+w.SetwerkCloud.user.id));
 return{dom,w,calls,cloud:w.SetwerkCloud,account,remote:()=>remote,setRemote:r=>remote=r,loadApp(){for(const file of ['exercises.js','exercises-en.js','i18n.js','transfer.js','app.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));}};
}
test('cloud payload excludes unfinished workout/draft and rejects injected IDs',()=>{
 const state=G.fresh();state.active=G.spontaneous();state.draft={name:'Unfinished'};state.sessions.push(session());state.templates.push(template());
 const data=C.project(state);assert.equal(data.active,undefined);assert.equal(data.draft,undefined);C.validate(data);
 data.sessions[0].id='" onclick="';assert.throws(()=>C.validate(data),/ID/);
 const unfinished=C.project(state);unfinished.sessions[0].items=[G.item({id:'exercise',name:'Squat',kind:'reps'})];assert.throws(()=>C.validate(unfinished),/Unfinished/);
});
test('three-way merge keeps independent workouts/deletions and detects conflicting edits',()=>{
 const base=C.project(G.fresh());base.templates.push(template());const a=C.clone(base),b=C.clone(base);a.sessions.push(session('a'));b.sessions.push(session('b'));
 const merged=C.merge(base,a,b);assert.deepEqual(merged.conflicts,[]);assert.deepEqual(new Set(merged.data.sessions.map(x=>x.id)),new Set(['a','b']));
 a.templates[0].name='Device A';b.templates[0].name='Device B';assert.deepEqual(C.merge(base,a,b).conflicts,['templates:plan']);
 const deleted=C.clone(base);deleted.templates=[];assert.equal(C.merge(base,deleted,base).data.templates.length,0);
});
test('active workout causes zero training requests; completion uploads one durable snapshot',async()=>{
 const x=setup();try{
  await x.cloud.connect({id:'alice',email:'alice@example.test'});x.calls.length=0;
  const state=G.fresh();state.active=G.spontaneous();x.cloud.saveLocal(state);await x.cloud.sync();assert.equal(x.calls.length,0);
  state.active.items.push(G.item({id:'exercise',name:'Squat',kind:'reps'}));x.cloud.saveLocal(state);await x.cloud.sync();assert.equal(x.calls.length,0);
  state.sessions.push(session());state.active=null;x.cloud.saveLocal(state);await x.cloud.sync();
  assert.deepEqual(x.calls.map(c=>c.method),['GET','POST']);assert.equal(x.calls[1].body.data.active,undefined);assert.equal(x.calls[1].body.data.sessions.length,1);assert.equal(x.account().pending,false);
 }finally{x.dom.window.close();}
});
test('offline completion survives reload in the same account and retries when online',async()=>{
 const x=setup();let y;try{
  await x.cloud.connect({id:'alice'});Object.defineProperty(x.w.navigator,'onLine',{value:false,configurable:true});x.calls.length=0;
  const state=G.fresh();state.sessions=[session()];x.cloud.saveLocal(state);await x.cloud.sync();assert.equal(x.calls.length,0);assert.equal(x.account().pending,true);
  y=setup({'setwerk.last-account.v1':{id:'alice'},'setwerk.account.v1.alice':x.account()});assert.equal(y.cloud.user.id,'alice');assert.equal(JSON.parse(y.cloud.readState()).sessions.length,1);
  await y.cloud.connect({id:'alice'});assert.equal(y.remote().data.sessions.length,1);assert.equal(y.account().pending,false);
 }finally{x.dom.window.close();y?.dom.window.close();}
});
test('account switch never moves the previous active workout into another account',async()=>{
 const x=setup();try{
  x.loadApp();await x.cloud.connect({id:'alice'});x.w.document.querySelector('[data-action="start-select"]').click();x.w.document.querySelector('[data-action="start-spontaneous"]').click();
  assert.ok(x.account().state.active);
  await x.cloud.connect({id:'bob'});assert.equal(x.account().state.active,null);assert.equal(x.account().state.sessions.length,0);
  const alice=JSON.parse(x.w.localStorage.getItem('setwerk.account.v1.alice'));assert.ok(alice.state.active);
  await x.cloud.connect({id:'alice'});assert.ok(x.w.document.querySelector('.focus-main'));
 }finally{x.dom.window.close();}
});
test('late read after starting a workout does not upload or replace its data',async()=>{
 const x=setup();try{
  await x.cloud.connect({id:'alice'});const state=G.fresh();state.sessions=[session()];x.cloud.saveLocal(state);
  let release;x.calls.length=0;x.w.fetch=async()=>{x.calls.push('GET');return new Promise(r=>release=()=>r({ok:true,json:async()=>({revision:0,data:null})}));};
  const request=x.cloud.sync();state.active=G.spontaneous();x.cloud.saveLocal(state);release();await request;
  assert.equal(x.calls.length,1);assert.ok(x.account().state.active);assert.equal(x.account().pending,true);
 }finally{x.dom.window.close();}
});
test('in-flight account response is ignored after switching accounts',async()=>{
 const x=setup();try{
  await x.cloud.connect({id:'alice'});let release;
  x.w.fetch=async()=>new Promise(r=>release=()=>r({ok:true,json:async()=>({revision:1,data:{...C.project(G.fresh()),sessions:[session('alice-only')]}})}));
  const request=x.cloud.sync();x.w.fetch=async()=>({ok:true,json:async()=>({revision:0,data:null})});await x.cloud.connect({id:'bob'});release();await request;
  assert.equal(x.cloud.user.id,'bob');assert.equal(x.account().state.sessions.length,0);
 }finally{x.dom.window.close();}
});
test('corrupt account cache is preserved and cannot be overwritten or uploaded',async()=>{
 const raw='{broken',x=setup({'setwerk.account.v1.alice':raw});try{
  await x.cloud.connect({id:'alice'});assert.equal(x.cloud.mode,'storage-error');assert.throws(()=>x.cloud.saveLocal(G.fresh()));await x.cloud.sync();assert.equal(x.calls.length,0);assert.equal(x.w.localStorage.getItem('setwerk.account.v1.alice'),raw);
 }finally{x.dom.window.close();}
});
test('local guest import is explicit, leaves original data intact, and is idempotent',async()=>{
 const guest=G.fresh();guest.sessions=[session('guest')];const x=setup({'setwerk.v1':guest});try{
  await x.cloud.connect({id:'alice'});assert.equal(x.account().state.sessions.length,0);await x.cloud.importGuest();await x.cloud.importGuest();assert.equal(x.account().state.sessions.length,1);assert.equal(JSON.parse(x.w.localStorage.getItem('setwerk.v1')).sessions.length,1);
 }finally{x.dom.window.close();}
});
test('conflicting edits stop upload and preserve local changes; backup can restore missing records',async()=>{
 const x=setup();try{
  x.setRemote({revision:1,data:{...C.project(G.fresh()),templates:[template()]}});await x.cloud.connect({id:'alice'});
  const state=x.account().state;state.templates[0].name='Local';x.cloud.saveLocal(state);const remote=C.project(G.fresh());remote.templates=[{...template(),name:'Remote'}];x.setRemote({revision:2,data:remote});x.calls.length=0;await x.cloud.sync();
  assert.equal(x.cloud.mode,'conflict');assert.deepEqual(x.calls.map(c=>c.method),['GET']);assert.equal(x.account().state.templates[0].name,'Local');
  x.w.URL.createObjectURL=()=> 'blob:backup';x.w.URL.revokeObjectURL=()=>{};x.w.HTMLAnchorElement.prototype.click=()=>{};x.cloud.useCloudVersion();assert.equal(x.account().state.templates[0].name,'Remote');assert.equal(JSON.parse(x.w.localStorage.getItem('setwerk.account.v1.alice.conflict-backup')).templates[0].name,'Local');
  const data=G.fresh();data.sessions=[session('backup')];await x.cloud.restoreBackup({size:500,text:async()=>JSON.stringify({format:'setwerk-backup-v1',data})});assert.equal(x.account().state.sessions.length,1);
 }finally{x.dom.window.close();}
});
test('service worker never caches private Netlify API responses',()=>{
 const source=fs.readFileSync(path.join(root,'sw.js'),'utf8');let handler;const vm=require('node:vm');vm.runInNewContext(source,{self:{location:{origin:'https://setwerk.test'},addEventListener:(name,fn)=>{if(name==='fetch')handler=fn;}},URL});
 let handled=false;handler({request:{method:'GET',url:'https://setwerk.test/.netlify/functions/workout-store'},respondWith(){handled=true;}});assert.equal(handled,false);
});
test('real workout UI saves feedback locally and sends only the finished session',async()=>{
 const x=setup();try{
  x.loadApp();await x.cloud.connect({id:'alice'});const q=s=>x.w.document.querySelector(s),click=action=>{const b=q('[data-action="'+action+'"]');assert.ok(b,action);b.click();};
  click('start-select');click('start-spontaneous');click('extend-final');q('#picker-search').value='Bankdrücken (Langhantel)';q('#picker-search').dispatchEvent(new x.w.Event('input',{bubbles:true}));q('#picker-results [data-action="choose-exercise"]').click();
  const state=x.account().state;state.active.items[0].sets=state.active.items[0].sets.slice(0,1);x.cloud.saveLocal(state);x.w.dispatchEvent(new x.w.CustomEvent('setwerk:account-state',{detail:{state,accountChanged:false}}));x.calls.length=0;
  click('complete-set');await x.cloud.sync();assert.equal(x.calls.length,0);click('save-active');
  q('#feedback-form').dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));await x.cloud.sync();
  assert.equal(x.account().state.active,null);assert.equal(x.account().state.sessions.length,1);const posted=x.calls.find(c=>c.method==='POST');assert.ok(posted);assert.equal(posted.body.data.sessions[0].items[0].sets[0].done,true);assert.equal(posted.body.data.active,undefined);
 }finally{x.dom.window.close();}
});
test('explicit local conflict choice preserves independent cloud workouts and a cloud backup',async()=>{
 const x=setup();try{
  x.setRemote({revision:1,data:{...C.project(G.fresh()),templates:[template()]}});await x.cloud.connect({id:'alice'});const local=x.account().state;local.templates[0].name='Local choice';x.cloud.saveLocal(local);
  x.setRemote({revision:2,data:{...C.project(G.fresh()),templates:[{...template(),name:'Other device'}],sessions:[session('other-device')]}});await x.cloud.sync();assert.equal(x.cloud.mode,'conflict');
  x.w.URL.createObjectURL=()=> 'blob:backup';x.w.URL.revokeObjectURL=()=>{};x.w.HTMLAnchorElement.prototype.click=()=>{};await x.cloud.useLocalVersion();
  assert.equal(x.remote().data.templates[0].name,'Local choice');assert.equal(x.remote().data.sessions[0].id,'other-device');assert.equal(JSON.parse(x.w.localStorage.getItem('setwerk.account.v1.alice.cloud-conflict-backup')).templates[0].name,'Other device');assert.equal(x.cloud.mode,'synced');
 }finally{x.dom.window.close();}
});
test('unchanged account data never uploads merely because JSON key order differs',async()=>{
 assert.equal(C.equal({a:1,b:2},{b:2,a:1}),true);const x=setup();try{
  await x.cloud.connect({id:'alice'});assert.equal(x.account().pending,false);assert.deepEqual(x.calls.map(c=>c.method),['GET']);
  x.cloud.saveLocal(x.account().state);await x.cloud.sync();assert.equal(x.account().pending,false);assert.equal(x.calls.some(c=>c.method==='POST'),false);
 }finally{x.dom.window.close();}
});
