(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GymCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const CATEGORIES=['Kraft','Ausdauer','Kraft-Ausdauer','Ballsport'];
const uid=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const clone=x=>JSON.parse(JSON.stringify(x));
function localDate(d=new Date()){const x=typeof d==='string'?new Date(d):d;return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;}
const OVERVIEW_BLOCKS=['start','weekly','steps','template','exercises','calendar','manual','recent'];
function overviewBlocks(value){return Array.isArray(value)?[...new Set(value.filter(id=>OVERVIEW_BLOCKS.includes(id)))]:[...OVERVIEW_BLOCKS];}
function validDate(date){return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(new Date(date+'T12:00:00').getTime())&&localDate(new Date(date+'T12:00:00'))===date;}
function validateSteps(date,count){if(!validDate(date)||date>localDate())throw Error('Bitte ein gültiges Datum bis heute auswählen.');if(typeof count!=='number'||!Number.isSafeInteger(count)||count<0)throw Error('Bitte eine ganze Schrittzahl ab 0 eingeben.');}
function fresh(){return{version:1,language:'de',templates:[],customExercises:[],sessions:[],dailySteps:{},overviewBlocks:overviewBlocks(),active:null,goals:{weekly:3,days:[],time:'18:00',reminders:false},reminderSeen:''};}
function setDefaults(kind='reps'){return{id:uid(),reps:kind==='reps'?10:0,weight:0,seconds:kind==='reps'?0:60,distance:0,type:'normal',rpe:'',rir:'',done:false,skipped:false};}
function item(ex,count=3,rest=120){return{uid:uid(),exerciseId:ex.id,exerciseName:ex.name,kind:ex.kind,rest,notes:'',sets:Array.from({length:count},()=>setDefaults(ex.kind))};}
function validateSet(s,kind,required=true){if(!['reps','time','distance'].includes(kind))throw new Error('Ungültige Messart.');for(const k of ['reps','weight','seconds','distance']){if(!Number.isFinite(Number(s[k]))||Number(s[k])<0)throw new Error('Bitte nur gültige, positive Trainingswerte eingeben.');}if(!Number.isInteger(Number(s.reps)))throw new Error('Wiederholungen müssen ganze Zahlen sein.');if(required&&kind==='reps'&&Number(s.reps)<1)throw new Error('Bitte mindestens eine Wiederholung eintragen.');if(required&&kind!=='reps'&&Number(s.seconds)<=0&&Number(s.distance)<=0)throw new Error('Bitte Dauer oder Strecke eintragen.');if(s.rpe!==''&&(Number(s.rpe)<1||Number(s.rpe)>10))throw new Error('RPE muss zwischen 1 und 10 liegen.');if(s.rir!==''&&(Number(s.rir)<0||Number(s.rir)>10))throw new Error('RIR muss zwischen 0 und 10 liegen.');}
function validateItems(items){if(!items.length)throw new Error('Bitte mindestens eine Übung hinzufügen.');for(const it of items){if(!it.sets.length||it.sets.length>50)throw new Error('Bitte 1–50 Sätze je Übung anlegen.');if(!Number.isFinite(+it.rest)||it.rest<0||it.rest>3600)throw new Error('Die Pause muss zwischen 0 und 3600 Sekunden liegen.');for(const s of it.sets)validateSet(s,it.kind);}}
function schedule(items){return items.flatMap((it,i)=>it.sets.map((_,s)=>({i,s})));}
function next(session){return schedule(session.items).find(p=>{const s=session.items[p.i].sets[p.s];return!s.done&&!s.skipped;})||null;}
function isActivity(w){return w.category==='Ausdauer'&&!!w.cardio||w.category==='Ballsport'&&!w.items.length;}
function validateDuration(minutes){if(typeof minutes!=='number'||!Number.isFinite(minutes)||minutes<0.1||minutes>525600)throw Error('Bitte eine Dauer zwischen 0,1 und 525600 Minuten eingeben.');}
function validateActivity(w){validateDuration(w.durationMinutes);if(w.category==='Ausdauer')validateCardio(w.cardio);else if(w.category==='Ballsport'&&(typeof w.sport!=='string'||!w.sport.trim()||w.sport.length>100))throw Error('Bitte eine Sportart eintragen.');}
function start(template,now=Date.now()){if(isActivity(template))validateActivity(template);else validateItems(template.items);const session={id:uid(),templateId:template.id||null,name:template.name,category:template.category||'Kraft',date:localDate(new Date(now)),startedAt:now,notes:template.notes||'',items:clone(template.items).map(it=>({...it,replacedEarly:false,sets:it.sets.map(s=>({...s,done:false,skipped:false,completedAt:null}))})),rest:null};if(isActivity(template)){session.durationMinutes=template.durationMinutes;if(template.cardio)session.cardio=clone(template.cardio);if(template.sport)session.sport=template.sport;}return session;}
function complete(session,now=Date.now()){if(session.rest&&session.rest.until>now)throw new Error('Die Pause läuft noch.');const p=next(session);if(!p)return null;const it=session.items[p.i],s=it.sets[p.s];validateSet(s,it.kind);s.done=true;s.completedAt=now;let rest=Number(it.rest);const n=next(session);if(n){const ni=session.items[n.i],ns=ni.sets[n.s];if(ns.type==='drop')rest=0;}session.rest=rest>0?{until:now+rest*1000,total:rest}:null;return{completed:p,next:n,rest};}
function doneCount(session){return session.items.reduce((n,it)=>n+it.sets.filter(s=>s.done).length,0);}
function completedExerciseCount(session){return session.items.filter(it=>!it.replacedEarly&&it.sets.length>0&&it.sets.every(s=>s.done&&!s.skipped)).length;}
function finish(session,now=Date.now()){if(isActivity(session)){const duration=session.actualDurationSeconds??Math.max(1,Math.round((now-session.startedAt)/1000));validateDuration(duration/60);if(session.cardio)validateCardio(session.cardio);const result={...clone(session),rest:null,endedAt:now,duration,items:[]};delete result.actualDurationSeconds;return result;}if(!doneCount(session))throw new Error('Es wurde noch kein Satz abgeschlossen.');return{...clone(session),rest:null,endedAt:now,duration:Math.max(1,Math.round((now-session.startedAt)/1000)),items:session.items.map(it=>({...clone(it),sets:it.sets.filter(s=>s.done).map(s=>({...clone(s),skipped:false}))})).filter(it=>it.sets.length)};}
function skipPending(session){for(const it of session.items)for(const s of it.sets)if(!s.done)s.skipped=true;session.rest=null;}
function volume(session){return session.items.reduce((a,it)=>a+it.sets.filter(s=>s.done&&s.type!=='warmup').reduce((b,s)=>b+(s.reps||0)*(s.weight||0),0),0);}
function exerciseHistory(sessions,id){return sessions.filter(w=>w.items.some(it=>it.exerciseId===id&&it.sets.some(s=>s.done))).sort((a,b)=>b.date.localeCompare(a.date)||(b.endedAt||0)-(a.endedAt||0));}
function best(sessions,id,kind='reps'){const ss=exerciseHistory(sessions,id).flatMap(w=>w.items.filter(it=>it.exerciseId===id).flatMap(it=>it.sets.filter(s=>s.done&&s.type!=='warmup').map(s=>({...s,date:w.date}))));if(!ss.length)return null;if(kind==='reps')return ss.sort((a,b)=>b.weight-a.weight||b.reps-a.reps)[0];return ss.sort((a,b)=>kind==='distance'?(b.distance-a.distance||b.seconds-a.seconds):(b.seconds-a.seconds))[0];}
function weekStart(date=localDate()){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);return localDate(d);}
function spontaneous(now=Date.now()){return{id:uid(),templateId:null,name:'Spontantraining',spontaneous:true,category:'Kraft',date:localDate(new Date(now)),startedAt:now,notes:'',items:[],rest:null};}
function replaceCurrentExercise(session,ex){
 const p=next(session);if(!p)throw new Error('Keine aktive Übung.');
 const old=session.items[p.i];if(old.exerciseId===ex.id)return false;
 const count=old.sets.filter(s=>!s.done&&!s.skipped).length;
 const replacement=item(ex,count,old.rest);
 const completed=old.sets.filter(s=>s.done);
 if(completed.length){old.replacedEarly=true;old.sets=completed;session.items.splice(p.i+1,0,replacement);}else session.items.splice(p.i,1,replacement);
 session.timer=null;return true;
}
function migrateState(value){const s={...fresh(),...value};s.language=['de','en'].includes(s.language)?s.language:'de';s.overviewBlocks=overviewBlocks(s.overviewBlocks);s.dailySteps=s.dailySteps&&typeof s.dailySteps==='object'&&!Array.isArray(s.dailySteps)?s.dailySteps:{};for(const w of [...s.templates,...s.sessions,s.active,s.draft].filter(Boolean))for(const it of w.items||[])delete it.group;return s;}
function validateFeedback(feedback){if(!feedback)return;for(const f of ['mood','effort'])if(feedback[f]!==null&&(!Number.isInteger(feedback[f])||feedback[f]<1||feedback[f]>5))throw new Error('Bitte eine Bewertung von 1 bis 5 wählen.');if(typeof feedback.note!=='string'||feedback.note.length>2000)throw new Error('Die Notiz darf maximal 2000 Zeichen lang sein.');}
const CARDIO_TYPES=['Laufen','Radfahren','Schwimmen','Crosstrainer','Rudern','Seilspringen','Sonstige'];
const CARDIO_MODES=['classic','interval','other'];
const cardioHasElevation=type=>['Laufen','Radfahren','Sonstige'].includes(type);
const cardioHasDistance=type=>type!=='Seilspringen';
function validateCardio(c){
 if(!c||!CARDIO_TYPES.includes(c.type))throw Error('Bitte eine Cardio-Art auswählen.');
 if(c.type==='Sonstige'&&(typeof c.other!=='string'||!c.other.trim()||c.other.length>100))throw Error('Bitte die Cardio-Art im Textfeld angeben.');
 if(c.type!=='Seilspringen'&&!(c.mode&&c.distanceMeters===null)&&(typeof c.distanceMeters!=='number'||!Number.isFinite(c.distanceMeters)||c.distanceMeters<0||c.distanceMeters>100000000))throw Error('Bitte eine gültige Distanz eingeben.');
 if(c.elevationMeters!==null&&(typeof c.elevationMeters!=='number'||!Number.isFinite(c.elevationMeters)||c.elevationMeters<0||c.elevationMeters>1000000))throw Error('Bitte gültige Höhenmeter eingeben oder das Feld leer lassen.');
 if(c.mode!==undefined){if(!CARDIO_MODES.includes(c.mode))throw Error('Bitte eine Cardio-Trainingsform auswählen.');if(c.mode==='other'&&(typeof c.modeName!=='string'||!c.modeName.trim()||c.modeName.length>100))throw Error('Bitte einen Namen für die Trainingsform eintragen.');if(c.mode==='interval'){const n=c.intervals;if(!n||!Number.isInteger(n.count)||n.count<1||n.count>1000||!Number.isFinite(n.workSeconds)||n.workSeconds<1||n.workSeconds>86400||!Number.isFinite(n.restSeconds)||n.restSeconds<0||n.restSeconds>3600)throw Error('Bitte gültige Intervalle, Belastungszeiten und Pausen eingeben.');if(n.distanceMeters!==null&&(!Number.isFinite(n.distanceMeters)||n.distanceMeters<0||n.distanceMeters>100000000))throw Error('Bitte eine gültige Intervall-Distanz eingeben.');}}
}
return{OVERVIEW_BLOCKS,overviewBlocks,validDate,validateSteps,CARDIO_TYPES,CARDIO_MODES,cardioHasElevation,cardioHasDistance,isActivity,validateActivity,validateDuration,validateCardio,spontaneous,replaceCurrentExercise,migrateState,validateFeedback,CATEGORIES,uid,clone,localDate,fresh,setDefaults,item,validateSet,validateItems,schedule,next,start,complete,doneCount,completedExerciseCount,finish,skipPending,volume,exerciseHistory,best,weekStart};
});
