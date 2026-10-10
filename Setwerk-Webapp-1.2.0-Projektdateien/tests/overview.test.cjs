const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),G=require('../dist/core.js'),C=require('../dist/cloud-core.js');
const root=path.join(__dirname,'../dist'),act=name=>`[data-action="${name}"]`;
function setup(stored=G.fresh(),cloud=false){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<html><body><div id="app"></div><dialog id="modal"></dialog><div id="toast"></div></body></html>',{url:'https://setwerk.test',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
 w.scrollTo=()=>{};w.scrollBy=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.localStorage.setItem('setwerk.v1',JSON.stringify(stored));
 const calls=[];let remote={revision:0,data:null};
 if(cloud)w.SetwerkFirebase={async readStore(){return remote;},async writeStore(owner,revision,data){calls.push({owner,data});remote={revision:revision+1,data};return remote;}};
 for(const file of ['core.js',...(cloud?['cloud-core.js','cloud.js']:[]),'exercises.js','exercises-en.js','i18n.js','transfer.js','app.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
 const q=selector=>w.document.querySelector(selector),click=selector=>{assert.ok(q(selector),selector);q(selector).click();},input=(selector,value)=>{q(selector).value=String(value);q(selector).dispatchEvent(new w.Event('input',{bubbles:true}));},submit=()=>q('#steps-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})),read=()=>JSON.parse(w.localStorage.getItem('setwerk.v1')),order=()=>[...w.document.querySelectorAll('[data-overview-block]')].map(el=>el.dataset.overviewBlock);
 return{dom,w,q,click,input,submit,read,order,errors,calls};
}
test('Manuelle Schritte sind pro Tag in Übersicht und Kalender editierbar und bleiben nach Reload erhalten',()=>{
 const x=setup(),today=G.localDate(),d=new Date();d.setDate(d.getDate()-1);const yesterday=G.localDate(d);
 try{
  x.input('#daily-steps',8250);x.submit();assert.equal(x.read().dailySteps[today],8250);assert.equal(x.read().sessions.length,0);
  x.click(act('nav-calendar'));assert.equal(x.q('#daily-steps').value,'8250');assert.match(x.q(`[data-date="${today}"] .cal-steps`).textContent,/8.?250/);
  if(yesterday.slice(0,7)!==today.slice(0,7))x.click('[data-action="month"][data-dir="-1"]');
  x.click(`[data-action="select-date"][data-date="${yesterday}"]`);assert.equal(x.q('#daily-steps').value,'');x.input('#daily-steps',0);x.submit();assert.equal(x.read().dailySteps[yesterday],0);
  x.input('#daily-steps',2100);x.submit();assert.equal(x.read().dailySteps[yesterday],2100);assert.equal(x.read().dailySteps[today],8250);
  x.click('[data-action="nav"][data-route="home"]');assert.equal(x.q('#daily-steps').value,'8250');const y=setup(x.read());try{assert.equal(y.q('#daily-steps').value,'8250');assert.equal(y.read().dailySteps[yesterday],2100);}finally{y.dom.window.close();}
  assert.deepEqual(x.errors,[]);
 }finally{x.dom.window.close();}
});
test('Schritte lehnen leere, negative, gebrochene und unsichere Werte sowie künftige Tage ab',()=>{
 const x=setup();try{
  for(const value of ['',-1,2.5,Number.MAX_SAFE_INTEGER+1]){x.input('#daily-steps',value);x.submit();assert.deepEqual(x.read().dailySteps,{});}
  const d=new Date();d.setDate(d.getDate()+1);const tomorrow=G.localDate(d);x.q('#steps-form').dataset.date=tomorrow;x.input('#daily-steps',100);x.submit();assert.deepEqual(x.read().dailySteps,{});
  x.click(act('nav-calendar'));if(tomorrow.slice(0,7)!==G.localDate().slice(0,7))x.click('[data-action="month"][data-dir="1"]');x.click(`[data-date="${tomorrow}"]`);assert.equal(x.q('#steps-form'),null);assert.throws(()=>G.validateSteps('2026-02-30',100));assert.deepEqual(x.errors,[]);
 }finally{x.dom.window.close();}
});
test('Bearbeiten steht unten; Blöcke werden verschoben, entfernt, hinzugefügt und dauerhaft gespeichert',()=>{
 const x=setup();try{
  assert.equal(x.q('.main').lastElementChild.className,'overview-editor');x.click(act('overview-edit'));
  x.click('[data-action="overview-move"][data-block="weekly"][data-dir="-1"]');assert.equal(x.order()[0],'weekly');assert.equal(x.read().overviewBlocks[0],'start');
  x.click('[data-action="overview-remove"][data-block="recent"]');assert.equal(x.q('[data-overview-block="recent"]'),null);assert.ok(x.q('[data-action="overview-add"][data-block="recent"]'));
  x.click('[data-action="overview-add"][data-block="recent"]');assert.equal(x.order().filter(id=>id==='recent').length,1);
  x.click('[data-action="overview-remove"][data-block="steps"]');x.click(act('overview-save'));assert.equal(x.read().overviewBlocks[0],'weekly');assert.equal(x.q('#daily-steps'),null);
  const y=setup(x.read());try{assert.equal(y.order()[0],'weekly');assert.equal(y.q('#daily-steps'),null);y.click(act('nav-calendar'));assert.ok(y.q('#steps-form'));}finally{y.dom.window.close();}
  x.click(act('overview-edit'));x.click('[data-action="overview-add"][data-block="steps"]');x.click(act('overview-cancel'));assert.equal(x.q('#daily-steps'),null);assert.deepEqual(x.errors,[]);
 }finally{x.dom.window.close();}
});
test('Blöcke lassen sich per Maus oder Touch-Griff verschieben, abbrechen und auch vollständig ausblenden',()=>{
 const x=setup();try{
  x.click(act('overview-edit'));const handle=x.q('[data-overview-handle="recent"]'),target=x.q('[data-overview-block="start"]');handle.setPointerCapture=()=>{};handle.releasePointerCapture=()=>{};x.w.document.elementFromPoint=()=>target;
  const pointer=(type,element)=>{const e=new x.w.Event(type,{bubbles:true});for(const [k,v] of Object.entries({pointerId:1,button:0,clientX:100,clientY:150}))Object.defineProperty(e,k,{value:v});element.dispatchEvent(e);};
  pointer('pointerdown',handle);pointer('pointermove',handle);assert.ok(target.classList.contains('overview-drop'));pointer('pointerup',handle);assert.equal(x.order()[0],'recent');assert.equal(x.w.document.body.classList.contains('overview-dragging'),false);
  const next=x.q('[data-overview-handle="recent"]');next.setPointerCapture=()=>{};pointer('pointerdown',next);pointer('pointercancel',next);assert.equal(x.w.document.body.classList.contains('overview-dragging'),false);
  for(const id of [...x.order()])x.click(`[data-action="overview-remove"][data-block="${id}"]`);x.click(act('overview-save'));assert.deepEqual(x.read().overviewBlocks,[]);const y=setup(x.read());try{assert.deepEqual(y.order(),[]);y.click(act('overview-edit'));assert.equal(y.w.document.querySelectorAll('[data-action="overview-add"]').length,G.OVERVIEW_BLOCKS.length);}finally{y.dom.window.close();}
  assert.deepEqual(x.errors,[]);
 }finally{x.dom.window.close();}
});
test('Speicherfehler erhalten Schritte und lassen den Übersichts-Entwurf offen',()=>{
 const state=G.fresh();state.dailySteps[G.localDate()]=6000;const x=setup(state);try{
  x.w.SetwerkCloud={saveLocal(){throw Error('Full');}};x.input('#daily-steps',7000);x.submit();assert.equal(x.read().dailySteps[G.localDate()],6000);x.click(act('overview-edit'));assert.equal(x.q('#daily-steps').value,'6000');
  x.click('[data-action="overview-remove"][data-block="recent"]');x.click(act('overview-save'));assert.ok(x.q(act('overview-save')));assert.ok(x.read().overviewBlocks.includes('recent'));x.click(act('overview-cancel'));assert.ok(x.q('[data-overview-block="recent"]'));assert.deepEqual(x.errors,[]);
 }finally{x.dom.window.close();}
});
test('Neue Eingaben und Bearbeitungsfunktionen verwenden auch die vorhandene englische Sprache',()=>{
 const state=G.fresh();state.language='en';const x=setup(state);try{assert.match(x.q('.steps-card').textContent,/Step counter/);assert.match(x.q('.steps-card').textContent,/Daily steps/);x.input('#daily-steps',100);x.submit();assert.equal(x.q('#toast').textContent,'Steps saved.');x.click(act('overview-edit'));assert.match(x.q('.overview-editor').textContent,/Edit overview/);assert.match(x.q('.overview-editor').textContent,/Add blocks/);assert.deepEqual(x.errors,[]);}finally{x.dom.window.close();}
});
test('Cloud-Projektion und alte Zustände unterstützen Schritte und Blöcke ohne Trainingsdaten zu ändern',()=>{
 const old=C.project(G.fresh());delete old.dailySteps;delete old.overviewBlocks;C.validate(old);const migrated=G.migrateState(old);assert.deepEqual(migrated.dailySteps,{});assert.deepEqual(migrated.overviewBlocks,G.OVERVIEW_BLOCKS);
 const state=G.fresh();state.dailySteps={'2026-10-09':5000};state.overviewBlocks=['steps','recent'];assert.deepEqual(C.project(state).dailySteps,state.dailySteps);C.validate(C.project(state));
 for(const dailySteps of [[],{'2026-02-30':200},{'2026-10-09':-1},{'2026-10-09':0.5}])assert.throws(()=>C.validate({...old,dailySteps}));
 for(const overviewBlocks of [['unknown'],['steps','steps'],'steps'])assert.throws(()=>C.validate({...old,overviewBlocks}));
});
test('Cloud-Merge vereinigt Schritte an verschiedenen Tagen und erkennt Änderungen am selben Tag',()=>{
 const base=C.project(G.fresh()),local=C.clone(base),remote=C.clone(base);local.dailySteps['2026-10-08']=4000;remote.dailySteps['2026-10-09']=8000;local.overviewBlocks=['steps','start'];
 const merged=C.merge(base,local,remote);assert.deepEqual(merged.conflicts,[]);assert.deepEqual(merged.data.dailySteps,{'2026-10-08':4000,'2026-10-09':8000});assert.deepEqual(merged.data.overviewBlocks,['steps','start']);
 remote.dailySteps['2026-10-08']=9000;assert.ok(C.merge(base,local,remote).conflicts.includes('dailySteps:2026-10-08'));remote.overviewBlocks=['recent'];assert.ok(C.merge(base,local,remote).conflicts.includes('overviewBlocks'));
 const legacy=C.clone(base);delete legacy.dailySteps;delete legacy.overviewBlocks;assert.deepEqual(C.merge(legacy,local,legacy).conflicts,[]);
});
test('Angemeldete UI synchronisiert Schritte und Anordnung; Kontowechsel setzt den Bearbeitungsmodus zurück',async()=>{
 const x=setup(G.fresh(),true);try{
  await x.w.SetwerkCloud.connect({id:'first',email:'a@example.test'});x.input('#daily-steps',4321);x.submit();x.click(act('overview-edit'));x.click('[data-action="overview-remove"][data-block="recent"]');x.click(act('overview-save'));await x.w.SetwerkCloud.sync();
  const uploaded=x.calls.at(-1);assert.equal(uploaded.owner,'first');assert.equal(uploaded.data.dailySteps[G.localDate()],4321);assert.ok(!uploaded.data.overviewBlocks.includes('recent'));x.click(act('overview-edit'));
  x.w.SetwerkFirebase.readStore=async()=>({revision:0,data:null});await x.w.SetwerkCloud.connect({id:'second',email:'b@example.test'});assert.equal(x.q('#daily-steps').value,'');assert.equal(x.q(act('overview-save')),null);assert.ok(x.q('[data-overview-block="recent"]'));assert.deepEqual(x.errors,[]);
 }finally{x.dom.window.close();}
});
