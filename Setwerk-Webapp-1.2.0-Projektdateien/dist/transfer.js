/* Versioned, self-contained workout exchange. No network requests or executable imports. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));else root.SetwerkTransfer=factory(root.GymCore);})(typeof globalThis!=='undefined'?globalThis:this,function(G){
'use strict';
const MAX_BYTES=1048576,MAX_TEXT=MAX_BYTES*2;
const fail=()=>{throw Error('Ungültige Workout-Datei oder ungültiger Code.');};
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
function string(x,max,optional=false){if(optional&&x==null)return '';if(typeof x!=='string'||x.length>max||(!optional&&!x.trim()))fail();return x;}
function number(x,min,max,integer=false){if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max||(integer&&!Number.isInteger(x)))fail();return x;}
function normalize(input){
 if(!object(input)||input.format!=='setwerk-workout'||input.version!==1||!['template','session'].includes(input.kind))fail();
 const w=input.workout;if(!object(w)||!G.CATEGORIES.includes(w.category)||!Array.isArray(w.items)||w.items.length>50)fail();
 const workout={name:string(w.name,100),category:w.category,notes:string(w.notes,10000,true),items:[]};
 for(const it of w.items){
  const e=it?.exercise;if(!object(e)||!['reps','time','distance'].includes(e.kind)||!Array.isArray(e.instructions)||e.instructions.length>30||!Array.isArray(it.sets)||it.sets.length<1||it.sets.length>50)fail();
  const exercise={id:string(e.id,150),name:string(e.name,100),kind:e.kind,muscle:string(e.muscle,80),equipment:string(e.equipment,80),instructions:e.instructions.map(x=>string(x,1000,true)),custom:e.custom===true};
  const sets=it.sets.map(s=>{if(!object(s)||!['normal','warmup','drop'].includes(s.type))fail();const set={reps:number(s.reps,0,100000,true),weight:number(s.weight,0,100000),seconds:number(s.seconds,0,31536000),distance:number(s.distance,0,100000000),type:s.type,rpe:s.rpe===''?'':number(s.rpe,1,10),rir:s.rir===''?'':number(s.rir,0,10)};G.validateSet(set,e.kind);return set;});
  workout.items.push({exercise,rest:number(it.rest,0,3600),notes:string(it.notes,10000,true),sets});
 }
 if(input.kind==='template'&&!workout.items.length)fail();
 if(input.kind==='session'){
  const date=string(w.date,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date>G.localDate())fail();
  workout.date=date;workout.duration=number(w.duration,1,31536000);
  if(w.cardio!=null){if(workout.category!=='Ausdauer'||!object(w.cardio))fail();const c=w.cardio;workout.cardio={type:string(c.type,100),other:string(c.other,100,true),distanceMeters:c.distanceMeters===null?null:number(c.distanceMeters,0,100000000),elevationMeters:c.elevationMeters===null?null:number(c.elevationMeters,0,1000000)};G.validateCardio(workout.cardio);if(c.type==='Seilspringen')workout.cardio.distanceMeters=null;}
  if(w.feedback!=null){if(!object(w.feedback))fail();workout.feedback={mood:w.feedback.mood===null?null:number(w.feedback.mood,1,5,true),effort:w.feedback.effort===null?null:number(w.feedback.effort,1,5,true),note:string(w.feedback.note,2000,true)};G.validateFeedback(workout.feedback);}
 }
 return{format:'setwerk-workout',version:1,kind:input.kind,workout};
}
function pack(record,kind,catalog,personal=false){
 const workout={name:record.name,category:record.category,notes:personal?record.notes||'':'',items:record.items.map(it=>{
  const e=catalog.find(e=>e.id===it.exerciseId)||{id:it.exerciseId,name:it.exerciseName,kind:it.kind,muscle:'Ganzkörper',equipment:'Keines',instructions:[],custom:true};
  return{exercise:{id:e.id,name:e.name,kind:e.kind,muscle:e.muscle,equipment:e.equipment,instructions:e.instructions||[],custom:!!e.custom},rest:Number(it.rest),notes:personal?it.notes||'':'',sets:it.sets.filter(s=>kind==='template'||s.done).map(s=>({reps:+s.reps,weight:+s.weight,seconds:+s.seconds,distance:+s.distance,type:s.type,rpe:personal?s.rpe:'',rir:personal?s.rir:''}))};
 }).filter(it=>it.sets.length)};
 if(kind==='session'){workout.date=record.date;workout.duration=record.duration;if(record.cardio)workout.cardio=record.cardio;if(personal&&record.feedback)workout.feedback=record.feedback;}
 return normalize({format:'setwerk-workout',version:1,kind,workout});
}
function json(bundle){const text=JSON.stringify(normalize(bundle));if(encodeURIComponent(text).replace(/%[0-9A-F]{2}/gi,'x').length>MAX_BYTES)throw Error('Dieses Workout ist zu groß zum Teilen.');return text;}
function code(bundle){const text=json(bundle),bytes=encodeURIComponent(text).replace(/%([0-9A-F]{2})/g,(_,hex)=>String.fromCharCode(parseInt(hex,16)));return'SW1.'+btoa(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function parse(text){
 if(typeof text!=='string'||text.length>MAX_TEXT)throw Error('Die Datei oder der Code ist zu groß (maximal 1 MB).');
 let raw=text.trim();
 try{if(raw.startsWith('SW1.')){const encoded=raw.slice(4).replace(/\s/g,'');if(!/^[A-Za-z0-9_-]+$/.test(encoded)||encoded.length%4===1)fail();const body=atob(encoded.replace(/-/g,'+').replace(/_/g,'/'));raw=decodeURIComponent(Array.from(body,c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join(''));}return normalize(JSON.parse(raw));}catch(e){if(e.message==='Die Datei oder der Code ist zu groß (maximal 1 MB).')throw e;fail();}
}
function prepareImport(input,target,catalog,now=Date.now()){
 const bundle=normalize(input),w=bundle.workout;
 if(!['template','session'].includes(target)||target==='session'&&bundle.kind!=='session'||target==='template'&&(!w.items.length||w.cardio))fail();
 const additions=[],mapping=new Map(),record={id:G.uid(),name:w.name,category:w.category,notes:w.notes,items:[]};
 for(const it of w.items){const e=it.exercise;let ex=mapping.get(e.id);
  if(!ex){const existing=catalog.find(x=>x.id===e.id&&!x.custom&&!e.custom&&x.name===e.name&&x.kind===e.kind)||[...catalog,...additions].find(x=>x.custom&&x.name===e.name&&x.kind===e.kind&&x.muscle===e.muscle&&x.equipment===e.equipment&&JSON.stringify(x.instructions)===JSON.stringify(e.instructions));ex=existing||{...G.clone(e),id:G.uid(),custom:true};if(!existing)additions.push(ex);mapping.set(e.id,ex);}else if(ex.name!==e.name||ex.kind!==e.kind)fail();
  const item=G.item(ex,it.sets.length,it.rest);item.notes=it.notes;item.sets=it.sets.map(s=>({...G.setDefaults(ex.kind),...s,done:target==='session',skipped:false}));record.items.push(item);
 }
 if(target==='session'){record.date=w.date;record.duration=w.duration;record.startedAt=new Date(w.date+'T12:00:00').getTime();record.endedAt=record.startedAt+w.duration*1000;record.recordedAt=now;record.manual=true;record.imported=true;if(w.cardio)record.cardio=G.clone(w.cardio);if(w.feedback)record.feedback=G.clone(w.feedback);}
 return{record,customExercises:additions};
}
return{MAX_BYTES,normalize,pack,json,code,parse,prepareImport};
});
