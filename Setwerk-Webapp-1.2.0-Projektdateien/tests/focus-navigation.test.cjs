const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),G=require('../dist/core.js'),root=path.join(__dirname,'../dist');
const act=name=>`[data-action="${name}"]`;
function fixture(){const state=G.fresh();state.active=G.start({name:'Navigation',items:[0,1,2].map(i=>G.item({id:'nav-'+i,name:'Übung '+(i+1),kind:i===1?'time':'reps'},3,0))});return state;}
function setup(state=fixture()){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));const dom=new JSDOM('<!doctype html><div id="app"></div><dialog id="modal"></dialog><div id="toast"></div>',{url:'https://setwerk.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
 w.scrollTo=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.localStorage.setItem('setwerk.v1',JSON.stringify(state));
 for(const file of ['exercises.js','exercises-en.js','i18n.js','core.js','transfer.js','app.js']){const script=w.document.createElement('script');script.textContent=fs.readFileSync(path.join(root,file),'utf8');w.document.body.append(script);}
 const q=s=>w.document.querySelector(s),click=s=>{assert.ok(q(s),s);q(s).click();},read=()=>JSON.parse(w.localStorage.getItem('setwerk.v1'));
 function swipe(target,dx,dy=0,options={}){for(const [type,x,y]of [['pointerdown',180,100],['pointerup',180+dx,100+dy]]){const event=new w.Event(type,{bubbles:true});Object.assign(event,{clientX:x,clientY:y,pointerId:1,button:0,isPrimary:true,...options});target.dispatchEvent(event);}}
 return{dom,w,q,click,read,swipe,errors};
}
function use(state,fn){const x=setup(state);try{fn(x);assert.deepEqual(x.errors,[]);}finally{x.dom.window.close();}}
test('Linkswischen öffnet alle Übungen, vertikale und kurze Gesten sowie Eingaben bleiben unberührt',()=>use(fixture(),x=>{
 x.swipe(x.q('.focus-main h1'),-20);assert.equal(x.q('.focus-exercise-list'),null);
 x.swipe(x.q('.focus-main h1'),-80,140);assert.equal(x.q('.focus-exercise-list'),null);
 x.swipe(x.q('[data-field=reps] strong'),-100);assert.equal(x.q('.focus-exercise-list'),null);
 x.swipe(x.q('.focus-main h1'),-100,5);assert.equal(x.w.document.querySelectorAll('.focus-exercise-row').length,3);assert.equal(x.q('#focus-list-title'),x.w.document.activeElement);
 assert.equal(x.q('.focus-row-count').textContent,'0/3');assert.ok(x.q('.focus-exercise-row').classList.contains('is-started'));
 assert.ok(x.w.document.querySelectorAll('.focus-exercise-row')[1].classList.contains('is-pending'));
 x.swipe(x.q('#focus-list-title'),100);assert.equal(x.q('#app .focus-exercise-list'),null);
}));
test('Auswahl startet keinen Satz; ein Start-Klick aktiviert die gewählte Übung; erst danach wird gezählt',()=>use(fixture(),x=>{
 const ids=x.read().active.items.map(it=>it.uid);x.click(act('focus-exercises'));x.click(`[data-action=select-focus-exercise][data-id="${ids[1]}"]`);
 assert.equal(x.q('.focus-main h1').textContent,'Übung 2');assert.equal(x.q(act('start-focus-exercise')).textContent,'Starte diese Übung');assert.equal(G.doneCount(x.read().active),0);
 x.click(act('start-focus-exercise'));assert.equal(G.doneCount(x.read().active),0);assert.equal(x.q(act('complete-set')).textContent,'Nächster Satz');
 x.click(act('complete-set'));const a=x.read().active;assert.equal(a.items[1].sets[0].done,true);assert.equal(a.items[0].sets[0].done,false);
 x.click(act('focus-exercises'));assert.equal(x.w.document.querySelectorAll('.focus-row-count')[1].textContent,'1/3');assert.ok(x.w.document.querySelectorAll('.focus-exercise-row')[1].classList.contains('is-started'));
}));
test('Auswahl und Startzustand überleben Reload, Eingaben betreffen ausschließlich die gewählte Übung',()=>use(fixture(),x=>{
 const id=x.read().active.items[2].uid;x.click(act('focus-exercises'));x.click(`[data-action=select-focus-exercise][data-id="${id}"]`);
 use(x.read(),y=>{assert.equal(y.q('.focus-main h1').textContent,'Übung 3');assert.ok(y.q(act('start-focus-exercise')));y.click('[data-action=edit-value][data-field=weight]');y.q('#quick-value').value='45';y.q('#value-form').dispatchEvent(new y.w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(y.read().active.items[2].sets[0].weight,45);assert.equal(y.read().active.items[0].sets[0].weight,0);y.click(act('start-focus-exercise'));use(y.read(),z=>{assert.equal(z.q(act('complete-set')).textContent,'Nächster Satz');});});
}));
test('Alle drei Status sind nur durch Zeilenformat sichtbar; abgeschlossene Übungen lassen sich sicher ansehen',()=>{
 const s=fixture();G.complete(s.active);G.complete(s.active);G.complete(s.active);G.complete(s.active);
 use(s,x=>{const id=s.active.items[0].uid;x.click(act('focus-exercises'));const rows=[...x.w.document.querySelectorAll('.focus-exercise-row')];assert.ok(rows[0].classList.contains('is-completed'));assert.ok(rows[1].classList.contains('is-started'));assert.ok(rows[2].classList.contains('is-pending'));assert.deepEqual(rows.map(r=>r.querySelector('.focus-row-count').textContent),['3/3','1/3','0/3']);assert.doesNotMatch(x.q('.focus-exercise-list').textContent,/Angefangen|Abgeschlossen|Noch nicht gestartet/);
 x.click(`[data-action=select-focus-exercise][data-id="${id}"]`);assert.equal(x.q('.focus-main h1').textContent,'Übung 1');assert.equal(x.q(act('complete-set')),null);assert.equal(x.q(act('start-focus-exercise')),null);assert.equal(x.w.document.querySelectorAll('.focus-completed-sets .finished-set').length,3);assert.equal(G.doneCount(x.read().active),4);
 });
});
test('Pause läuft beim Navigieren weiter und verhindert Abschluss und Start; Stoppuhr schreibt in die ursprüngliche Übung',()=>{
 const s=fixture();s.active.items[0].rest=120;G.complete(s.active);const until=s.active.rest.until;
 use(s,x=>{x.swipe(x.q('.rest-overlay h2'),-100);assert.ok(x.q('.focus-exercise-list'));assert.equal(x.read().active.rest.until,until);x.click(`[data-action=select-focus-exercise][data-id="${s.active.items[2].uid}"]`);assert.ok(x.q('.rest-overlay.is-minimized'));assert.equal(x.read().active.rest.until,until);assert.ok(x.q(act('start-focus-exercise')).disabled);x.click(act('skip-rest'));x.click(act('start-focus-exercise'));x.click(act('complete-set'));assert.equal(x.read().active.items[2].sets[0].done,true);});
 const timed=fixture();G.selectFocusExercise(timed.active,timed.active.items[1].uid);G.startFocusExercise(timed.active);timed.active.timer={startedAt:Date.now()-45000};
 use(timed,x=>{x.click(act('focus-exercises'));x.click(`[data-action=select-focus-exercise][data-id="${timed.active.items[2].uid}"]`);assert.equal(x.read().active.timer,null);assert.ok(x.read().active.items[1].sets[0].seconds>=45);assert.equal(x.read().active.items[2].sets[0].seconds,0);});
});
test('Gewählte Übung wird vollständig absolviert; danach bleiben vorherige offene Sätze verfügbar',()=>{
 const a=fixture().active;G.selectFocusExercise(a,a.items[2].uid);assert.equal(G.complete(a),null);assert.equal(G.startFocusExercise(a),true);for(let i=0;i<3;i++)assert.equal(G.complete(a).completed.i,2);assert.equal(G.next(a).i,0);assert.equal(G.doneCount(a),3);assert.equal(G.completedExerciseCount(a),1);
});
test('Gleiche Übung bleibt aktiv und erneuter Wechsel erfordert einen Start; Übersicht zählt doppelte Übungen separat',()=>use(fixture(),x=>{
 const s=x.read();s.active.items[2].exerciseId=s.active.items[0].exerciseId;use(s,y=>{const id=s.active.items[0].uid;y.click(act('focus-exercises'));y.click(`[data-action=select-focus-exercise][data-id="${id}"]`);assert.ok(y.q(act('complete-set')));y.click(act('focus-exercises'));y.click(`[data-action=select-focus-exercise][data-id="${s.active.items[2].uid}"]`);assert.ok(y.q(act('start-focus-exercise')));y.click(act('focus-exercises'));assert.equal(y.w.document.querySelectorAll('.focus-exercise-row').length,3);y.click(`[data-action=select-focus-exercise][data-id="${id}"]`);assert.ok(y.q(act('start-focus-exercise')));});
}));
test('Neue Navigation ist auch auf Englisch vollständig übersetzt',()=>{
 const s=fixture();s.language='en';use(s,x=>{x.click(act('focus-exercises'));assert.equal(x.q('#focus-list-title').textContent,'All exercises');x.click(`[data-action=select-focus-exercise][data-id="${s.active.items[2].uid}"]`);assert.equal(x.q(act('start-focus-exercise')).textContent,'Start this exercise');});
});
test('Plus ergänzt Übungen in der Liste, erhält Auswahl und Pause und ändert die Vorlage nicht',()=>{
 const s=fixture();s.active.setRest=45;s.templates=[{id:'plan',name:'Vorlage',items:G.clone(s.active.items)}];G.selectFocusExercise(s.active,s.active.items[1].uid);G.startFocusExercise(s.active);s.active.timer={startedAt:Date.now()-12000};s.active.rest={until:Date.now()+90000,total:90,minimized:true};
 use(s,x=>{const before=x.read().active;x.click(act('focus-exercises'));x.click(act('add-focus-exercise'));const chosen=x.q('#picker-results [data-action=choose-exercise]');assert.ok(chosen);chosen.click();const a=x.read().active;assert.equal(a.items.length,4);assert.equal(x.w.document.querySelectorAll('#app .focus-exercise-row').length,4);assert.equal(a.items[3].sets.length,3);assert.equal(a.items[3].rest,45);assert.equal(a.focusExerciseUid,before.focusExerciseUid);assert.equal(a.focusNeedsStart,before.focusNeedsStart);assert.deepEqual(a.rest,before.rest);assert.deepEqual(a.timer,before.timer);assert.equal(x.read().templates[0].items.length,3);assert.equal(x.w.document.querySelectorAll('#app .focus-row-count')[3].textContent,'0/3');
 x.click(act('add-focus-exercise'));x.click('#modal [data-action=close-modal]');assert.equal(x.read().active.items.length,4);assert.ok(x.q('#app .focus-exercise-list'));
 });
});
function pointer(x,target,type,y,id=7){const e=new x.w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{clientX:100,clientY:y,pointerId:id,button:0,isPrimary:true});target.dispatchEvent(e);}
function geometry(x){[...x.w.document.querySelectorAll('#app [data-focus-row]')].forEach((row,i)=>{row.getBoundingClientRect=()=>({top:100+i*80,left:20,width:400,height:72,bottom:172+i*80});});}
test('Ziehen am Griff ändert die Reihenfolge und erhält aktive Übung, Satzdaten, Stoppuhr und Pause',()=>{
 const s=fixture(),a=s.active;G.complete(a);G.selectFocusExercise(a,a.items[1].uid);G.startFocusExercise(a);a.timer={startedAt:Date.now()-15000};a.rest={until:Date.now()+90000,total:90,minimized:true};
 use(s,x=>{const before=x.read().active,id=before.items[1].uid;x.click(act('focus-exercises'));geometry(x);const handle=x.q(`[data-focus-handle="${id}"]`);pointer(x,handle,'pointerdown',200);pointer(x,handle,'pointermove',110);assert.ok(x.q('.focus-drag-ghost'));assert.ok(x.q('#app .focus-drop-before'));assert.deepEqual(x.read().active.items,before.items);pointer(x,handle,'pointerup',110);
 const after=x.read().active;assert.deepEqual(after.items.map(it=>it.uid),[before.items[1].uid,before.items[0].uid,before.items[2].uid]);assert.equal(after.focusExerciseUid,id);assert.equal(after.focusNeedsStart,false);assert.deepEqual(after.timer,before.timer);assert.deepEqual(after.rest,before.rest);assert.deepEqual(after.items[1].sets,before.items[0].sets);assert.equal(G.next(after).i,0);assert.equal(x.q('.focus-drag-ghost'),null);assert.equal(x.q(`[data-focus-handle="${id}"]`),x.w.document.activeElement);
 use(x.read(),y=>{assert.equal(y.q('.focus-main h1').textContent,'Übung 2');assert.equal(y.read().active.items[0].uid,id);});
 });
});
test('Abbruch, fremde Pointer und Tippen am Griff ändern keine Daten; Pfeiltasten funktionieren als Alternative',()=>use(fixture(),x=>{
 x.click(act('focus-exercises'));geometry(x);const before=x.read().active.items.map(it=>it.uid),handle=x.q(`[data-focus-handle="${before[0]}"]`);
 pointer(x,handle,'pointerdown',120);pointer(x,handle,'pointerup',120);assert.deepEqual(x.read().active.items.map(it=>it.uid),before);assert.equal(x.q('#focus-move-form'),null);
 pointer(x,handle,'pointerdown',120);pointer(x,handle,'pointermove',310,9);assert.equal(x.q('.focus-drag-ghost'),null);pointer(x,handle,'pointermove',310);assert.ok(x.q('.focus-drag-ghost'));pointer(x,handle,'pointercancel',310);assert.deepEqual(x.read().active.items.map(it=>it.uid),before);assert.equal(x.q('.focus-drag-ghost'),null);
 handle.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));assert.deepEqual(x.read().active.items.map(it=>it.uid),[before[1],before[0],before[2]]);assert.equal(x.read().active.focusExerciseUid,before[0]);assert.equal(G.next(x.read().active).i,1);
}));
test('Ziehen nach unten bleibt getrennt von Wisch-Navigation und leere Spontantrainings können über das Plus beginnen',()=>{
 use(fixture(),x=>{const before=x.read().active.items.map(it=>it.uid);x.click(act('focus-exercises'));geometry(x);const handle=x.q(`[data-focus-handle="${before[0]}"]`);pointer(x,handle,'pointerdown',120);pointer(x,handle,'pointermove',340);pointer(x,handle,'pointerup',340);assert.deepEqual(x.read().active.items.map(it=>it.uid),[before[1],before[2],before[0]]);assert.equal(x.read().active.focusExerciseUid,before[0]);assert.ok(x.q('#app .focus-exercise-list'));});
 const s=G.fresh();s.active=G.spontaneous();use(s,x=>{x.click(act('focus-exercises'));assert.ok(x.q(act('add-focus-exercise')));x.click(act('add-focus-exercise'));x.click('#picker-results [data-action=choose-exercise]');assert.equal(x.read().active.items.length,1);assert.equal(x.q('#app .focus-row-count').textContent,'0/3');});
});

test('Übungszeilen erlauben Wischen in beide Richtungen; Tippen bleibt Auswahl und Wischklick wird abgefangen',()=>use(fixture(),x=>{
 x.click(act('focus-exercises'));const row=x.q('#app .focus-row-select'),id=x.read().active.focusExerciseUid;
 x.swipe(row,-100);assert.ok(x.q('#app .focus-workout-list'));assert.equal(x.read().active.focusExerciseUid,id);
 const click=new x.w.MouseEvent('click',{bubbles:true,cancelable:true,detail:1});row.dispatchEvent(click);assert.equal(click.defaultPrevented,true);assert.ok(x.q('#app .focus-workout-list'));
 x.swipe(row,100);assert.equal(x.q('#app .focus-workout-list'),null);
 x.click(act('focus-exercises'));x.swipe(x.q('#app .focus-row-select'),10,120);assert.ok(x.q('#app .focus-workout-list'));
 x.click('#app .focus-row-select');assert.equal(x.q('#app .focus-workout-list'),null);
}));
