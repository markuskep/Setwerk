const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),G=require('../assets/core.js');
const root=path.join(__dirname,'../assets'),settle=()=>new Promise(r=>setImmediate(r));
function setup({enabled=false,granted=false,supported=true,days={},stored=G.fresh(),pendingRead=false}={}){
 const dom=new JSDOM('<!doctype html><html><body><div id="app"></div><dialog id="modal"></dialog><div id="toast"></div></body></html>',{url:'https://appassets.androidplatform.net/assets/index.html',runScripts:'dangerously',pretendToBeVisual:true});
 const w=dom.window,calls=[];let failSave=false,resolveRead;
 w.scrollTo=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.localStorage.setItem('setwerk.v1',JSON.stringify(stored));if(enabled)w.localStorage.setItem('setwerk.health.steps.v1.guest','true');
 w.SetwerkCloud={user:null,readState:()=>w.localStorage.getItem('setwerk.v1'),saveLocal:state=>{if(failSave)throw Error('Full');w.localStorage.setItem('setwerk.v1',JSON.stringify(state));}};
 w.SetwerkNative={call:async(operation)=>{calls.push(operation);if(operation==='health-read'){if(pendingRead)return new Promise(r=>{resolveRead=r;});return{days};}return{supported,granted};}};
 for(const name of ['exercises.js','exercises-en.js','i18n.js','core.js','transfer.js','app.js','android-health.js']){
  const script=w.document.createElement('script');script.textContent=fs.readFileSync(path.join(root,name),'utf8');w.document.body.append(script);
 }
 return{w,dom,calls,read:()=>JSON.parse(w.localStorage.getItem('setwerk.v1')),failSave:()=>{failSave=true;},resolve:result=>resolveRead(result),setDays:value=>{days=value;}};
}
test('No steps are read before explicit opt-in; connecting explains Firebase and updates the gauge',async()=>{
 const today=G.localDate(),x=setup({granted:true,days:{[today]:1234}});
 try{await settle();assert.deepEqual(x.calls,['health-status']);x.w.document.querySelector('[data-health=explain]').click();assert.match(x.w.document.querySelector('#modal').textContent,/Firebase/);x.w.document.querySelector('[data-health=connect]').click();await settle();assert.equal(x.read().dailySteps[today],1234);assert.match(x.w.document.querySelector('.steps-count').textContent,/1.234/);assert.equal(x.w.localStorage.getItem('setwerk.health.steps.v1.guest'),'true');assert.equal(x.w.document.querySelector('#modal').open,false);}finally{x.dom.window.close();}
});
test('Repeated sync replaces daily totals instead of adding them; missing days preserve manual values, recorded zero is valid',async()=>{
 const today=G.localDate(),yesterday=G.localDate(new Date(Date.now()-86400000)),state=G.fresh();state.dailySteps={[today]:4500,[yesterday]:8000};
 const x=setup({enabled:true,granted:true,days:{[today]:0},stored:state});try{await settle();assert.equal(x.read().dailySteps[today],0);assert.equal(x.read().dailySteps[yesterday],8000);x.setDays({[today]:2000});await x.w.SetwerkHealth.sync();await x.w.SetwerkHealth.sync();assert.equal(x.read().dailySteps[today],2000);x.w.document.querySelector('[data-action=nav][data-route=calendar]').click();assert.match(x.w.document.querySelector(`[data-date="${today}"] .cal-steps`).textContent,/2.000/);}finally{x.dom.window.close();}
});
test('Denied and unsupported devices preserve existing step values and never read health data',async()=>{
 for(const supported of [true,false]){const state=G.fresh();state.dailySteps[G.localDate()]=7000;const x=setup({enabled:true,granted:false,supported,stored:state});try{await settle();assert.equal(x.calls.includes('health-read'),false);assert.equal(x.read().dailySteps[G.localDate()],7000);if(!supported)assert.equal(x.w.document.querySelector('[data-health=explain]'),null);}finally{x.dom.window.close();}}
});
test('Disconnecting invalidates a pending result and stops future automatic reads',async()=>{
 const x=setup({enabled:true,granted:true,pendingRead:true});try{await settle();x.w.SetwerkHealth.disconnect();x.resolve({days:{[G.localDate()]:2000}});await settle();assert.equal(x.read().dailySteps[G.localDate()],undefined);x.w.dispatchEvent(new x.w.Event('setwerk:resume'));await settle();assert.equal(x.calls.filter(x=>x==='health-read').length,1);}finally{x.dom.window.close();}
});
test('A response for a previous account cannot write steps into the newly selected account',async()=>{
 const x=setup({enabled:true,granted:true,pendingRead:true});try{await settle();x.w.SetwerkCloud.user={id:'bob'};x.w.dispatchEvent(new x.w.CustomEvent('setwerk:account-state',{detail:{state:G.fresh(),accountChanged:true}}));x.resolve({days:{[G.localDate()]:9876}});await settle();assert.equal(x.read().dailySteps[G.localDate()],undefined);assert.equal(x.w.localStorage.getItem('setwerk.health.steps.v1.bob'),null);}finally{x.dom.window.close();}
});
test('Invalid payloads and failed storage cannot destroy existing step counts',async()=>{
 const today=G.localDate(),state=G.fresh();state.dailySteps[today]=111;const x=setup({enabled:true,granted:true,stored:state});try{await settle();x.setDays({[today]:-1});await x.w.SetwerkHealth.sync();assert.equal(x.read().dailySteps[today],111);x.setDays({[today]:222});x.failSave();await x.w.SetwerkHealth.sync();assert.equal(x.read().dailySteps[today],111);assert.equal(x.w.eval('state.dailySteps[GymCore.localDate()]'),111);}finally{x.dom.window.close();}
});
test('Sync leaves an open step form untouched; overlapping reads are suppressed',async()=>{
 const today=G.localDate(),x=setup({enabled:true,granted:true,days:{[today]:100}});try{await settle();x.w.document.querySelector('[data-action=edit-steps]').click();const input=x.w.document.querySelector('#daily-steps');input.value='999';x.setDays({[today]:200});await Promise.all([x.w.SetwerkHealth.sync(),x.w.SetwerkHealth.sync()]);assert.equal(x.w.document.querySelector('#daily-steps'),input);assert.equal(input.value,'999');assert.equal(x.read().dailySteps[today],100);assert.equal(x.calls.filter(x=>x==='health-read').length,2);}finally{x.dom.window.close();}
});

test('Health synchronization preserves the focus workout and an unfinished weight edit',async()=>{
 const state=G.fresh();state.active=G.start({id:'plan',name:'Training',category:'Kraft',items:[G.item({id:'test',name:'Exercise',kind:'reps'},2,60)]});
 const x=setup({enabled:true,granted:true,stored:state});try{await settle();x.w.document.querySelector('[data-action=edit-value][data-field=weight]').click();const input=x.w.document.querySelector('#quick-value');input.value='42.5';const active=JSON.stringify(x.read().active);x.setDays({[G.localDate()]:1234});await x.w.SetwerkHealth.sync();assert.equal(x.w.document.querySelector('#quick-value'),input);assert.equal(input.value,'42.5');assert.equal(JSON.stringify(x.read().active),active);assert.equal(x.w.location.hash,'#focus');assert.equal(x.read().dailySteps[G.localDate()],1234);}finally{x.dom.window.close();}
});
