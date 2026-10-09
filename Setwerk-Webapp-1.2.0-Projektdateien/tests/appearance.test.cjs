const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),root=path.join(__dirname,'../dist');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup({cached={},read,write}={}){
 const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://setwerk.test',runScripts:'outside-only'}),w=dom.window,remote=new Map(),writes=[];
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
 for(const [owner,value] of Object.entries(cached))w.localStorage.setItem('setwerk.firebase.appearance.v1.'+owner,JSON.stringify(value));
 w.SetwerkCloud={user:null,description:()=>'',profile:null};
 w.SetwerkFirebase={readAppearance:read||async function(owner){return remote.get(owner)||'standard'},writeAppearance:write||async function(owner,theme){writes.push([owner,theme]);remote.set(owner,theme)}};
 w.eval(fs.readFileSync(path.join(root,'appearance.js'),'utf8'));
 return{dom,w,remote,writes,appearance:w.SetwerkAppearance};
}
test('all five themes persist per account, reload from cache and reset for guests',async()=>{
 const x=setup();try{x.appearance.connect({id:'alice'});await settle();for(const theme of ['cherry','orange','light-blue','black-white','standard']){x.appearance.select(theme);await settle();assert.equal(x.w.document.documentElement.dataset.theme,theme);assert.equal(x.remote.get('alice'),theme);assert.equal(JSON.parse(x.w.localStorage.getItem('setwerk.firebase.appearance.v1.alice')).pending,false)}
 x.appearance.select('cherry');await settle();x.appearance.connect({id:'bob'});await settle();assert.equal(x.appearance.theme,'standard');x.appearance.connect({id:'alice'});assert.equal(x.appearance.theme,'cherry');x.appearance.connect(null);assert.equal(x.appearance.theme,'standard');assert.throws(()=>x.appearance.select('orange'));
 }finally{x.dom.window.close()}
});
test('offline theme choices survive reopening and synchronize on reconnection',async()=>{
 const x=setup({write:async()=>{throw Error('offline')}});let y;try{x.appearance.connect({id:'alice'});await settle();x.appearance.select('orange');await settle();assert.equal(x.appearance.mode,'offline');const cached=JSON.parse(x.w.localStorage.getItem('setwerk.firebase.appearance.v1.alice'));assert.equal(cached.pending,true);
 y=setup({cached:{alice:cached}});y.appearance.connect({id:'alice'});assert.equal(y.appearance.theme,'orange');await settle();assert.equal(y.remote.get('alice'),'orange');assert.equal(y.appearance.mode,'synced');
 }finally{x.dom.window.close();y?.dom.window.close()}
});
test('late account responses cannot replace another account or a newer local selection',async()=>{
 let resolve;const x=setup({read:owner=>owner==='alice'?new Promise(r=>resolve=r):Promise.resolve('standard')});try{x.appearance.connect({id:'alice'});x.appearance.select('orange');resolve('cherry');await settle();assert.equal(x.appearance.theme,'orange');assert.equal(x.remote.get('alice'),'orange');
 x.appearance.connect(null);x.appearance.connect({id:'alice'});x.appearance.connect({id:'bob'});resolve('cherry');await settle();assert.equal(x.appearance.theme,'standard');assert.equal(x.w.document.documentElement.dataset.theme,'standard');assert.throws(()=>x.appearance.select('javascript:bad'));
 }finally{x.dom.window.close()}
});
test('signed-in profile menu opens accessible color choices and updates selection immediately',async()=>{
 const x=setup();try{x.appearance.connect({id:'alice'});await settle();x.w.document.querySelector('#app').innerHTML='<div class="account-control"><button data-auth-open></button></div>';
 x.w.eval(fs.readFileSync(path.join(root,'account-ui.js'),'utf8').replace('export function createAccountUI','window.createAccountUI=function createAccountUI'));const ui=x.w.createAccountUI({}),button=x.w.document.querySelector('[data-auth-open]');ui.refresh({id:'alice',email:'alice@example.test',name:'Alice'});ui.toggleMenu(button);const menu=x.w.document.querySelector('#account-menu');assert.deepEqual([...menu.children].map(n=>n.textContent),['Kontodaten','Farben','Abmelden','Konto löschen']);menu.children[1].click();
 const choices=[...x.w.document.querySelectorAll('[data-theme-choice]')];assert.equal(choices.length,5);choices[1].click();assert.equal(choices[1].getAttribute('aria-pressed'),'true');assert.equal(x.w.document.documentElement.dataset.theme,'cherry');await settle();assert.match(x.w.document.querySelector('#appearance-status').textContent,/Im Konto gespeichert/);
 ui.refresh(null);assert.equal(x.w.document.querySelector('#account-details').open,false);ui.toggleMenu(button);assert.equal(x.w.document.querySelector('#account-menu'),null);
 }finally{x.dom.window.close()}
});
