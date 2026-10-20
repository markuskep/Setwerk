const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),G=require('../dist/core.js'),root=path.join(__dirname,'../dist');
const act=name=>`[data-action="${name}"]`;
function fixture(count=3,sets=4,rest=0){const s=G.fresh();s.active=G.start({name:'Kontrollen',items:Array.from({length:count},(_,i)=>G.item({id:'control-'+i,name:'Übung '+(i+1),kind:'reps'},sets,rest))});s.templates=[{id:'original',name:'Vorlage',items:G.clone(s.active.items)}];return s;}
function setup(state=fixture(),native=false){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<!doctype html><div id="app"></div><dialog id="modal"></dialog><div id="toast"></div>',{url:'https://setwerk.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
 w.scrollTo=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.localStorage.setItem('setwerk.v1',JSON.stringify(state));
 const nativeCalls=[];if(native)w.AndroidGym={readState:()=>w.localStorage.getItem('setwerk.v1'),writeState:raw=>{w.localStorage.setItem('setwerk.v1',raw);return true;},syncRest:until=>nativeCalls.push(['sync',until]),scheduleRest:until=>nativeCalls.push(['schedule',until]),cancelRest:()=>nativeCalls.push(['cancel']),playRestStart:()=>{},accountSettings:()=>{}};
 let hold=null;const realTimeout=w.setTimeout.bind(w),realClear=w.clearTimeout.bind(w);
 w.setTimeout=(fn,delay,...args)=>delay===550?(hold=fn,-1):realTimeout(fn,delay,...args);w.clearTimeout=id=>{if(id===-1)hold=null;else realClear(id);};
 for(const file of ['exercises.js','exercises-en.js','i18n.js','core.js','transfer.js','app.js']){const script=w.document.createElement('script');script.textContent=fs.readFileSync(path.join(root,file),'utf8');w.document.body.append(script);}
 const q=s=>w.document.querySelector(s),click=s=>{assert.ok(q(s),s);q(s).click();},read=()=>JSON.parse(w.localStorage.getItem('setwerk.v1'));
 function pointer(target,type,x=100,y=100){const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{clientX:x,clientY:y,pointerId:1,button:0,isPrimary:true});target.dispatchEvent(e);return e;}
 function swipe(target,dx,dy=0){pointer(target,'pointerdown');pointer(target,'pointermove',100+dx,100+dy);pointer(target,'pointerup',100+dx,100+dy);}
 function value(field,n){click(`[data-action="edit-value"][data-field="${field}"]`);q('#quick-value').value=String(n);q('#value-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));}
 return{dom,w,q,click,read,pointer,swipe,value,errors,nativeCalls,hold:()=>{const fn=hold;hold=null;fn?.();}};
}
function use(state,fn){const x=setup(state);try{fn(x);assert.deepEqual(x.errors,[]);}finally{x.dom.window.close();}}
test('Pausenansicht behält ausschließlich die Übungsauswahl oben rechts',()=>{
 const s=fixture(2,2,120);G.complete(s.active);use(s,x=>{assert.equal(x.w.document.querySelectorAll('.focus-top '+act('focus-exercises')).length,1);assert.equal(x.q('.rest-actions '+act('focus-exercises')),null);x.click('.focus-top '+act('focus-exercises'));assert.ok(x.q('.focus-workout-list'));assert.equal(x.q('.rest-overlay'),null);});
});
test('Vorhandene Satzkreise wählen spätere Sätze zum Bearbeiten ohne Satzfortschritt',()=>use(fixture(),x=>{
 const before=x.read(),id=before.active.items[0].uid;x.click(`[data-action="select-focus-set"][data-set="3"]`);x.value('weight',42.5);
 const a=x.read().active;assert.equal(a.items[0].sets[3].weight,42.5);assert.equal(a.items[0].sets[0].weight,0);assert.equal(G.doneCount(a),0);assert.deepEqual(G.next(a),{i:0,s:0});assert.equal(x.q(act('complete-set')),null);assert.ok(x.q(act('return-focus-set')));assert.equal(x.w.document.querySelectorAll('.set-dot').length,4);x.click(act('return-focus-set'));assert.equal(x.q('.set-dot[aria-current]').dataset.set,'0');assert.deepEqual(x.read().templates,before.templates);
}));
test('Abgeschlossene Übung lässt sich während Übung drei bearbeiten; laufende Übung bleibt erhalten',()=>{
 const s=fixture();for(let k=0;k<8;k++)G.complete(s.active);s.active.focusExerciseUid=s.active.items[2].uid;s.active.rest={until:Date.now()+90000,total:90,minimized:true};const until=s.active.rest.until;
 use(s,x=>{x.click(act('focus-exercises'));x.click(`[data-action="select-focus-exercise"][data-id="${s.active.items[0].uid}"]`);x.click('[data-action="select-focus-set"][data-set="1"]');x.value('reps',7);x.value('weight',65);
 const a=x.read().active;assert.equal(a.items[0].sets[1].reps,7);assert.equal(a.items[0].sets[1].weight,65);assert.equal(a.items[0].sets[1].done,true);assert.equal(a.items[0].sets[1].completedAt,s.active.items[0].sets[1].completedAt);assert.equal(G.doneCount(a),8);assert.deepEqual(G.next(a),{i:2,s:0});assert.equal(a.rest.until,until);assert.equal(x.q(act('complete-set')),null);
 x.click(act('focus-settings'));assert.equal(x.q('[data-context="active"][data-item="0"][data-set="1"][data-field="reps"]').disabled,false);x.click(act('close-settings'));x.click(act('return-focus-set'));assert.equal(x.q('.focus-main h1').textContent,'Übung 3');assert.equal(x.read().active.rest.until,until);
 use(x.read(),y=>{assert.equal(y.read().active.items[0].sets[1].weight,65);assert.deepEqual(G.next(y.read().active),{i:2,s:0});});
 });
});
test('Langes Drücken öffnet Löschoptionen; Löschen erhält andere Sätze, Vorlage und laufende Pause',()=>{
 const s=fixture();s.active.focusExerciseUid=s.active.items[2].uid;s.active.items[2].focusStarted=true;s.active.timer={startedAt:Date.now()-10000};s.active.rest={until:Date.now()+90000,total:90,minimized:true};
 use(s,x=>{const before=x.read();x.click(act('focus-exercises'));const row=x.q('.focus-row-select');x.pointer(row,'pointerdown');x.hold();assert.ok(x.q(act('delete-focus-exercise')));x.pointer(row,'pointerup');assert.ok(x.q('#modal').open);x.click(act('delete-focus-exercise'));const after=x.read();assert.equal(after.active.items.length,2);assert.equal(after.active.items[1].uid,before.active.items[2].uid);assert.deepEqual(after.active.items[1].sets,before.active.items[2].sets);assert.deepEqual(after.active.timer,before.active.timer);assert.deepEqual(after.active.rest,before.active.rest);assert.equal(after.active.focusExerciseUid,before.active.focusExerciseUid);assert.deepEqual(after.templates,before.templates);});
});
test('Scrollen, Wischen und abgebrochenes Drücken lösen keine Löschoption aus; Kontextmenü ist zugänglich',()=>use(fixture(),x=>{
 x.click(act('focus-exercises'));let row=x.q('.focus-row-select');x.pointer(row,'pointerdown');x.pointer(row,'pointermove',100,145);x.hold();assert.equal(x.q('#modal').open,false);x.pointer(row,'pointerup',100,145);
 x.pointer(row,'pointerdown');x.pointer(row,'pointercancel');x.hold();assert.equal(x.q('#modal').open,false);
 row.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'F10',shiftKey:true,bubbles:true,cancelable:true}));assert.ok(x.q(act('delete-focus-exercise')));x.click(act('close-modal'));x.swipe(x.q('.focus-row-select'),120);assert.equal(x.q('#app .focus-workout-list'),null);assert.equal(x.read().active.items.length,3);
}));
test('Aktive und letzte Übung können gelöscht und anschließend neue Übungen ergänzt werden',()=>use(fixture(1,2),x=>{
 x.click(act('focus-exercises'));x.q('.focus-row-select').dispatchEvent(new x.w.MouseEvent('contextmenu',{bubbles:true,cancelable:true}));x.click(act('delete-focus-exercise'));assert.equal(x.read().active.items.length,0);assert.equal(x.read().active.rest,null);x.click(act('add-focus-exercise'));x.click('#picker-results '+act('choose-exercise'));assert.equal(x.read().active.items.length,1);
}));
test('Letzter Satz öffnet Bestätigung; Abbrechen bucht nichts, Erweitern bucht genau einmal ohne Pause',()=>use(fixture(1,1,120),x=>{
 assert.equal(x.q(act('complete-set')),null);assert.ok(x.q(act('finish-workout')));x.click(act('finish-workout'));assert.equal(G.doneCount(x.read().active),0);assert.ok(x.q(act('extend-finish-workout')));x.click(act('close-modal'));assert.equal(G.doneCount(x.read().active),0);
 x.click(act('finish-workout'));x.click(act('extend-finish-workout'));assert.equal(G.doneCount(x.read().active),1);assert.equal(x.read().active.rest,null);assert.equal(x.q('.rest-overlay'),null);x.click('#picker-results '+act('choose-exercise'));assert.equal(x.read().active.items.length,2);assert.equal(G.doneCount(x.read().active),1);assert.deepEqual(G.next(x.read().active),{i:1,s:0});
}));
test('Bestätigter Abschluss speichert letzten Satz ohne weitere Pause und behält Feedback-Ablauf',()=>use(fixture(1,2,120),x=>{
 x.click(act('complete-set'));x.click(act('skip-rest'));x.click(act('finish-workout'));x.click(act('confirm-finish-workout'));assert.equal(G.doneCount(x.read().active),2);assert.equal(x.read().active.rest,null);assert.ok(x.q('#feedback-form'));x.q('#feedback-form').dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(x.read().active,null);assert.equal(x.read().sessions.length,1);assert.equal(G.doneCount(x.read().sessions[0]),2);
}));
test('Nach dem allerletzten Satz erzeugt auch der Trainingskern keine Pause',()=>{const a=fixture(1,1,120).active;const result=G.complete(a);assert.equal(result.next,null);assert.equal(result.rest,0);assert.equal(a.rest,null);});
test('Standardregister wechseln per horizontaler Geste; vertikale Gesten, Eingaben und Dialoge bleiben unberührt',()=>use(G.fresh(),x=>{
 const swipe=(dx,dy=0)=>x.swipe(x.q('.main'),dx,dy);swipe(-120,180);assert.equal(x.w.location.hash,'#home');swipe(-25);assert.equal(x.w.location.hash,'#home');swipe(120);assert.equal(x.w.location.hash,'#home');
 for(const route of ['templates','exercises','calendar','progress']){swipe(-120);assert.equal(x.w.location.hash,'#'+route);}swipe(-120);assert.equal(x.w.location.hash,'#progress');swipe(120);assert.equal(x.w.location.hash,'#calendar');
 x.click('[data-action="nav"][data-route="exercises"]');x.swipe(x.q('#exercise-search'),-120);assert.equal(x.w.location.hash,'#exercises');x.click('#exercise-results '+act('exercise'));swipe(-120);assert.equal(x.w.location.hash,'#exercises');
}));
test('Satznavigation und Abschlussdialog sind auf Englisch verfügbar',()=>{const s=fixture(1,2);s.language='en';use(s,x=>{x.click('[data-action="select-focus-set"][data-set="1"]');assert.equal(x.q(act('return-focus-set')).textContent,'Back to current set');x.click(act('return-focus-set'));x.click(act('complete-set'));assert.equal(x.q(act('finish-workout')).textContent,'Finish workout');x.click(act('finish-workout'));assert.equal(x.q('.modal-head h2').textContent,'Finish workout?');assert.equal(x.q(act('extend-finish-workout')).textContent,'Add more exercises');});});

 test('Native Countdown-Anbindung übernimmt absolute Endzeit, hält sie beim Bearbeiten und löscht sie beim Überspringen',()=>{
 const s=fixture(2,2,120);G.complete(s.active);const x=setup(s,true);try{const until=s.active.rest.until;assert.deepEqual(x.nativeCalls.at(-1),['sync',until]);x.click(act('minimize-rest'));x.value('weight',55);assert.deepEqual(x.nativeCalls.at(-1),['sync',until]);x.click(act('skip-rest'));assert.ok(x.nativeCalls.some(call=>call[0]==='cancel'));assert.deepEqual(x.nativeCalls.at(-1),['sync',0]);assert.equal(x.read().active.rest,null);}finally{x.dom.window.close();}
 });
 test('Letzter Satz plant auch in Android keine weitere Hintergrundpause',()=>{const x=setup(fixture(1,1,120),true);try{x.click(act('finish-workout'));x.click(act('confirm-finish-workout'));assert.equal(x.nativeCalls.some(call=>call[0]==='schedule'),false);assert.ok(x.nativeCalls.some(call=>call[0]==='sync'&&call[1]===0));assert.equal(x.nativeCalls.at(-1)[0],'cancel');assert.equal(G.doneCount(x.read().active),1);}finally{x.dom.window.close();}});

 test('Wischklick wird nur auf seiner Zeile abgefangen; anderer Button reagiert sofort',()=>use(fixture(),x=>{x.click(act('focus-exercises'));const row=x.q('.focus-row-select');x.swipe(row,-120);const ghost=new x.w.MouseEvent('click',{bubbles:true,cancelable:true,detail:1});row.dispatchEvent(ghost);assert.equal(ghost.defaultPrevented,true);const back=x.q('.focus-top '+act('close-focus-exercises'));const next=new x.w.MouseEvent('click',{bubbles:true,cancelable:true,detail:1});back.dispatchEvent(next);assert.equal(next.defaultPrevented,false);assert.equal(x.q('#app .focus-workout-list'),null);}));

test('Minimaler Focus zeigt nur Übungsfortschritt; ein einzelner Satz füllt den Balken noch nicht',()=>use(fixture(2,2),x=>{
 assert.equal(x.q('.focus-title'),null);assert.equal(x.q('.focus-main .eyebrow'),null);assert.equal(x.q('.focus-details'),null);assert.equal(x.q('.next-card'),null);assert.equal(x.q('.focus-last'),null);
 const progress=()=>Number(x.q('[role=progressbar]').getAttribute('aria-valuenow'));
 assert.equal(progress(),0);x.click(act('complete-set'));assert.equal(progress(),0);x.click(act('complete-set'));assert.equal(progress(),1);assert.equal(x.q('[role=progressbar] i').style.width,'50%');
}));
test('Pfeile ändern nur den betrachteten Satz und Gewicht exakt in 0,5 kg Schritten, auch mit Pfund',()=>{
 const s=fixture(2,4,120);s.goals.weightUnit='lb';G.complete(s.active);const until=s.active.rest.until;
 use(s,x=>{x.click(act('minimize-rest'));x.click('[data-action=select-focus-set][data-set="3"]');
 const arrow=(field,dir)=>`[data-action=adjust-focus-value][data-field=${field}][data-dir="${dir}"]`;
 x.click(arrow('reps',1));x.click(arrow('weight',1));x.click(arrow('weight',1));assert.equal(x.read().active.items[0].sets[3].reps,11);assert.equal(x.read().active.items[0].sets[3].weight,1);assert.deepEqual(G.next(x.read().active),{i:0,s:1});assert.equal(x.read().active.rest.until,until);
 x.click(arrow('weight',-1));assert.equal(x.read().active.items[0].sets[3].weight,.5);x.click(arrow('weight',-1));assert.equal(x.q(arrow('weight',-1)).disabled,true);
 x.click('[data-action=select-focus-set][data-set="0"]');x.click(arrow('reps',-1));assert.equal(x.read().active.items[0].sets[0].reps,9);assert.equal(x.read().active.items[0].sets[0].done,true);assert.equal(G.doneCount(x.read().active),1);
 });
});
test('Stift öffnet den Editor für die betrachtete, auch abgeschlossene Übung',()=>{
 const s=fixture(2,2);s.active.items[0].sets.forEach(st=>st.done=true);use(s,x=>{x.click(act('focus-exercises'));x.click(`[data-action=select-focus-exercise][data-id="${s.active.items[0].uid}"]`);x.click('.exercise-pencil');assert.equal(x.q('#picker-search'),null);assert.equal(x.q('#modal .exercise-edit h3').textContent,'Übung 1');assert.equal(x.q('#modal [data-field=weight]').disabled,false);assert.equal(x.q(act('replace-exercise')),null);});
});
test('Letzter Eintrag ist standardmäßig aus und über Einstellungen dauerhaft aktivierbar',()=>use(fixture(),x=>{
 assert.equal(x.q('.focus-last'),null);x.w.SetwerkPersonalization.open();assert.equal(x.q('[name=showLastSet]').checked,false);x.q('[name=showLastSet]').checked=true;x.q('#goals-form').dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(x.read().goals.showLastSet,true);assert.ok(x.q('.focus-last'));
}));
test('Einheitenwechsel wandelt die Anzeige und Eingaben um, erhält kg Daten und unveränderte Eingaben exakt',()=>{
 const s=fixture();s.active.items[0].sets[0].weight=60;use(s,x=>{
 x.w.SetwerkPersonalization.open();x.q('[name=weightUnit]').value='lb';x.q('[name=distanceUnit]').value='mi';x.q('#goals-form').dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(x.read().goals.weightUnit,'lb');assert.equal(x.read().goals.distanceUnit,'mi');assert.equal(x.read().active.items[0].sets[0].weight,60);assert.match(x.q('.focus-values').textContent,/132,28.*PFUND/s);
 x.click('[data-action=edit-value][data-field=weight]');const initial=x.q('#quick-value').value;assert.ok(Math.abs(Number(initial)-132.2773573109)<1e-8);x.q('#value-form').dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(x.read().active.items[0].sets[0].weight,60);
 x.value('weight',22.046226218487757);assert.ok(Math.abs(x.read().active.items[0].sets[0].weight-10)<1e-10);x.click('.exercise-pencil');assert.match(x.q('#modal input[data-field=weight]').getAttribute('aria-label'),/Pfund/);const field=x.q('#modal input[data-field=weight]');field.value='44.092452436975514';field.dispatchEvent(new x.w.Event('input',{bubbles:true}));assert.ok(Math.abs(x.read().active.items[0].sets[0].weight-20)<1e-10);
 });
});
test('Meilen im Streckenfokus werden in Metern gespeichert und im Verlauf korrekt angezeigt',()=>{
 const s=fixture(1,2);s.goals.distanceUnit='mi';s.active.items[0].kind='distance';s.active.items[0].sets.forEach(st=>Object.assign(st,{seconds:60,distance:1609.344}));use(s,x=>{assert.match(x.q('.focus-values').textContent,/1MEILEN/);x.value('distance',2);assert.equal(x.read().active.items[0].sets[0].distance,3218.688);x.click('.exercise-pencil');assert.equal(x.q('#modal input[data-field=distance]').value,'2');});
});
test('Registerwechsel animiert Klick und Wischgeste in der jeweiligen Richtung',()=>use(G.fresh(),x=>{
 x.click('[data-action=nav][data-route=calendar]');assert.ok(x.q('.main.tab-motion-forward'));x.click('[data-action=nav][data-route=templates]');assert.ok(x.q('.main.tab-motion-back'));x.swipe(x.q('.main'),-120);assert.ok(x.q('.main.tab-motion-forward'));assert.equal(x.w.location.hash,'#exercises');
}));
test('Meilen funktionieren auch beim Cardio-Nachtrag ohne Änderung des gespeicherten Meterformats',()=>use(G.fresh(),x=>{
 x.w.SetwerkPersonalization.setGoals({distanceUnit:'mi'});x.w.createDraft('manual',null,{category:'Ausdauer',name:'Laufen',durationMinutes:30});const field=x.q('[data-cardio=distanceKm]');field.value='2';field.dispatchEvent(new x.w.Event('input',{bubbles:true}));x.q('#editor-form').dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(x.read().sessions[0].cardio.distanceMeters,3219);x.click(act('session'));assert.match(x.q('#modal').textContent,/2 mi/);
}));
test('Ältere Daten erhalten metrische Standards; Cloud-Synchronisierung prüft neue Einstellungen',()=>{
 const C=require('../dist/cloud-core.js'),old=G.fresh();delete old.goals.showLastSet;delete old.goals.weightUnit;delete old.goals.distanceUnit;const migrated=G.migrateState(old);assert.equal(migrated.goals.showLastSet,false);assert.equal(migrated.goals.weightUnit,'kg');assert.equal(migrated.goals.distanceUnit,'m');const projected=C.project(migrated);projected.goals.weightUnit='lb';projected.goals.distanceUnit='mi';projected.goals.showLastSet=true;assert.doesNotThrow(()=>C.validate(projected));for(const field of ['weightUnit','distanceUnit','showLastSet']){const invalid=G.clone(projected);invalid.goals[field]='invalid';assert.throws(()=>C.validate(invalid));}
});
