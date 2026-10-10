(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));else root.SetwerkCloudCore=factory(root.GymCore);})(typeof globalThis!=='undefined'?globalThis:this,function(G){
  'use strict';
  const collections=['templates','sessions','customExercises'];
  const clone=value=>JSON.parse(JSON.stringify(value));
  function equal(a,b){
    if(a===b)return true;
    if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
    const keys=Object.keys(a);
    return keys.length===Object.keys(b).length&&keys.every(key=>Object.prototype.hasOwnProperty.call(b,key)&&equal(a[key],b[key]));
  }
  function project(state){return clone({version:1,language:state.language||'de',templates:state.templates||[],sessions:state.sessions||[],customExercises:state.customExercises||[],dailySteps:state.dailySteps||{},overviewBlocks:state.overviewBlocks??G.overviewBlocks(),goals:{...G.fresh().goals,...state.goals},...(state.profile?{profile:state.profile}:{})});}
  function validate(value){
    if(!value||value.version!==1||!['de','en'].includes(value.language)||Object.keys(value).some(k=>!['version','language','templates','sessions','customExercises','goals','profile','dailySteps','overviewBlocks'].includes(k)))throw Error('Invalid state');
    if(value.dailySteps!==undefined){
      if(!value.dailySteps||typeof value.dailySteps!=='object'||Array.isArray(value.dailySteps)||Object.keys(value.dailySteps).length>10000)throw Error('Invalid daily steps');
      for(const [date,count] of Object.entries(value.dailySteps))if(!G.validDate(date)||typeof count!=='number'||!Number.isSafeInteger(count)||count<0)throw Error('Invalid daily steps');
    }
    if(value.overviewBlocks!==undefined&&(!Array.isArray(value.overviewBlocks)||value.overviewBlocks.length>G.OVERVIEW_BLOCKS.length||value.overviewBlocks.some(id=>!G.OVERVIEW_BLOCKS.includes(id))||new Set(value.overviewBlocks).size!==value.overviewBlocks.length))throw Error('Invalid overview blocks');
    if(value.profile){
      const p=value.profile;
      if(typeof p!=='object'||Object.keys(p).some(k=>!['name','photo'].includes(k))||typeof p.name!=='string'||p.name.length>80||typeof p.photo!=='string'||p.photo.length>100000||(p.photo&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(p.photo)))throw Error('Invalid profile');
    }
    for(const key of collections){
      if(!Array.isArray(value[key])||value[key].length>10000)throw Error('Invalid collection');
      const ids=new Set();
      for(const record of value[key]){
        if(!record||typeof record.id!=='string'||! /^[A-Za-z0-9_-]{1,100}$/.test(record.id)||ids.has(record.id))throw Error('Invalid ID');
        ids.add(record.id);
        if(typeof record.name!=='string'||record.name.length>1000)throw Error('Invalid name');
        if(key==='customExercises'){
          if(!['reps','time','distance'].includes(record.kind)||typeof record.muscle!=='string'||typeof record.equipment!=='string'||!Array.isArray(record.instructions)||record.instructions.some(s=>typeof s!=='string'||s.length>10000))throw Error('Invalid exercise');
        }else{
          if(!G.CATEGORIES.includes(record.category))throw Error('Invalid category');
          if(!Array.isArray(record.items)||record.items.length>300)throw Error('Invalid exercises');
          for(const item of record.items){
            if(!item||!Array.isArray(item.sets)||item.sets.length>100||typeof item.exerciseId!=='string'||! /^[A-Za-z0-9_-]{1,100}$/.test(item.exerciseId)||typeof item.exerciseName!=='string'||!['reps','time','distance'].includes(item.kind)||!Number.isFinite(item.rest)||item.rest<0||item.rest>3600)throw Error('Invalid sets');
            for(const set of item.sets){
              if(!set||!['normal','warmup','drop'].includes(set.type)||['reps','weight','seconds','distance'].some(k=>typeof set[k]!=='number'||!Number.isFinite(set[k])))throw Error('Invalid set');
              G.validateSet(set,item.kind);
              if(key==='sessions'&&set.done!==true)throw Error('Unfinished session');
            }
          }
          if(key==='templates'&&record.cardio)G.validateActivity(record);
          if(key==='templates'&&record.category==='Ballsport'&&!record.items.length)G.validateActivity(record);
          if(key==='sessions'){
            if(typeof record.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(record.date)||!Number.isFinite(record.duration)||record.duration<0)throw Error('Invalid session');
            if(record.feedback)G.validateFeedback(record.feedback);
            if(record.cardio)G.validateCardio(record.cardio);
          }
        }
      }
    }
    const g=value.goals;
    if(!g||g.dailySteps!==undefined&&(!Number.isSafeInteger(g.dailySteps)||g.dailySteps<1)||!Number.isInteger(g.weekly)||g.weekly<1||g.weekly>21||!Array.isArray(g.days)||g.days.some(d=>!Number.isInteger(d)||d<0||d>6)||typeof g.reminders!=='boolean'||typeof g.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(g.time))throw Error('Invalid goals');
    return value;
  }
  function merge(base,local,remote){
    const result={version:1},conflicts=[];
    for(const key of ['language','goals','profile','overviewBlocks']){
      const normalize=s=>key==='overviewBlocks'?(s[key]??G.overviewBlocks()):key==='goals'?{...G.fresh().goals,...s[key]}:s[key],b=normalize(base),l=normalize(local),r=normalize(remote);
      if(equal(l,b))result[key]=r;
      else if(equal(r,b)||equal(l,r))result[key]=l;
      else{conflicts.push(key);result[key]=l;}
    }
    result.dailySteps={};
    const steps=[base,local,remote].map(s=>s.dailySteps||{});
    for(const date of new Set(steps.flatMap(s=>Object.keys(s)))){
      const [b,l,r]=steps.map(s=>s[date]);let selected;
      if(equal(l,b))selected=r;
      else if(equal(r,b)||equal(l,r))selected=l;
      else{conflicts.push('dailySteps:'+date);selected=l;}
      if(selected!==undefined)result.dailySteps[date]=selected;
    }
    for(const key of collections){
      const maps=[base,local,remote].map(s=>new Map(s[key].map(r=>[r.id,r])));
      const ids=new Set([...remote[key].map(r=>r.id),...local[key].map(r=>r.id),...base[key].map(r=>r.id)]);
      result[key]=[];
      for(const id of ids){
        const [b,l,r]=maps.map(m=>m.get(id)); let selected;
        if(equal(l,b))selected=r;
        else if(equal(r,b)||equal(l,r))selected=l;
        else{conflicts.push(key+':'+id);selected=l;}
        if(selected)result[key].push(clone(selected));
      }
    }
    return {data:clone(result),conflicts};
  }
  return {clone,equal,project,validate,merge};
});
