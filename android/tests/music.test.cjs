const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(path.join(__dirname,'../assets/android-music.js'),'utf8');
const fixture=()=>({supported:true,granted:true,active:true,sessionKey:'music:1',appName:'Test player',title:'Night Drive',artist:'Alex Morgan',playing:true,position:64000,duration:200000,speed:1,canPlay:true,canPause:true,canPrevious:true,canNext:true,canSeek:true,next:{id:'next:2',title:'Momentum',artist:'Nova'},canRemoveNext:true});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup(initial=fixture(),expand=true) {
 const dom=new JSDOM('<body><section class="focus-shell"><main class="focus-main"></main><footer class="focus-footer"></footer></section></body>',{url:'https://appassets.androidplatform.net/assets/index.html',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[];let state=initial,error=null,ignoreRemove=false;
 w.document.documentElement.lang='de';w.AndroidGym={};
 w.SetwerkNative={call:async(operation,body)=>{calls.push({operation,body});if(error)throw error;if(operation==='music-state')return structuredClone(state);if(operation==='music-pause')state.playing=false;if(operation==='music-play')state.playing=true;if(operation==='music-seek')state.position=body.position;if(operation==='music-next')state.title='Momentum';if(operation==='music-remove-next'&&!ignoreRemove)state.next={id:'next:3',title:'Second Wind',artist:'Daybreak'};return{requested:true};}};
 w.eval(source);if(expand)w.document.querySelector('[data-music-expand]').click();
 const q=s=>w.document.querySelector(s),click=action=>q(`[data-music-action="${action}"]`).click();
 return{dom,w,calls,q,click,setState:value=>{state=value;},setError:value=>{error=value;},ignoreRemove:value=>{ignoreRemove=value;}};
}
test('music permission is requested only after tapping setup; empty player has no controls',async()=>{
 const x=setup({supported:true,granted:false,active:false});try{await settle();assert.match(x.q('#setwerk-music').textContent,/Benachrichtigungszugriff/);assert.equal(x.calls.filter(c=>c.operation==='music-connect').length,0);x.click('connect');await settle();assert.equal(x.calls.filter(c=>c.operation==='music-connect').length,1);x.setState({supported:true,granted:true,active:false});await x.w.SetwerkMusic.refresh();assert.equal(x.q('.music-controls'),null);assert.match(x.q('#setwerk-music').textContent,/Starte ein Lied/);}finally{x.dom.window.close();}
});
test('playback, skipping and seeking address the displayed media session',async()=>{
 const x=setup();try{await settle();assert.equal(x.q('.music-track strong').textContent,'Night Drive');x.click('pause');await settle();assert.ok(x.q('[data-music-action=play]'));x.click('play');await settle();x.click('previous');await settle();x.click('next');await settle();assert.equal(x.q('.music-track strong').textContent,'Momentum');const slider=x.q('[data-music-seek]');slider.value='100000';slider.dispatchEvent(new x.w.Event('change',{bubbles:true}));await settle();for(const op of ['music-pause','music-play','music-previous','music-next','music-seek']){const call=x.calls.find(c=>c.operation===op);assert.equal(call.body.sessionKey,'music:1');}assert.equal(x.calls.find(c=>c.operation==='music-seek').body.position,100000);}finally{x.dom.window.close();}
});
test('unsupported actions stay disabled; hidden queues cannot be removed',async()=>{
 const s=fixture();s.canSeek=false;s.canNext=false;s.canPrevious=false;s.canRemoveNext=false;
 const x=setup(s);try{await settle();assert.equal(x.q('[data-music-seek]').disabled,true);assert.equal(x.q('[data-music-action=next]').disabled,true);assert.equal(x.q('[data-music-action=remove-next]'),null);x.click('next');await settle();assert.equal(x.calls.filter(c=>c.operation==='music-next').length,0);x.setState({...s,next:null});await x.w.SetwerkMusic.refresh();assert.equal(x.q('.music-next'),null);}finally{x.dom.window.close();}
});
test('next-track deletion waits for a provider update and sends the original queue id',async()=>{
 const x=setup();try{await settle();x.ignoreRemove(true);x.click('remove-next');await settle();assert.equal(x.q('.music-next-track strong').textContent,'Momentum');assert.equal(x.q('[data-music-action=remove-next]').disabled,true);assert.match(x.q('.music-status').textContent,/wird entfernt/);assert.equal(x.calls.find(c=>c.operation==='music-remove-next').body.nextId,'next:2');x.setState({...fixture(),next:{id:'next:3',title:'Second Wind'}});await x.w.SetwerkMusic.refresh();assert.equal(x.q('.music-next-track strong').textContent,'Second Wind');assert.equal(x.q('[data-music-action=remove-next]').disabled,false);}finally{x.dom.window.close();}
});
test('permission revocation and media-session errors do not leave usable stale controls',async()=>{
 const x=setup();try{await settle();x.setState({supported:true,granted:false,active:false});await x.w.SetwerkMusic.refresh();assert.equal(x.q('.music-controls'),null);x.setState(fixture());await x.w.SetwerkMusic.refresh();x.setError({code:'music/session-changed'});x.click('next');await settle();assert.match(x.q('.music-status').textContent,/Wiedergabe hat sich geändert/);assert.equal(x.q('.music-controls'),null);}finally{x.dom.window.close();}
});
test('metadata is escaped, english labels work and the player survives workout rerenders and rests',async()=>{
 const x=setup({...fixture(),title:'<img src=x onerror=alert(1)>',artist:'\" onclick=\"bad'});try{await settle();assert.equal(x.q('.music-track img'),null);assert.equal(x.q('.music-track strong').textContent,'<img src=x onerror=alert(1)>');x.w.document.documentElement.lang='en';x.q('.focus-shell').innerHTML='<main class="focus-main"></main><div class="rest-overlay"><div class="rest-actions"></div></div><footer class="focus-footer"></footer>';x.w.dispatchEvent(new x.w.Event('setwerk:render'));await settle();assert.equal(x.q('.rest-overlay #setwerk-music'),null);assert.ok(x.q('.focus-shell > #setwerk-music'));assert.equal(x.q('[data-music-action=pause]').getAttribute('aria-label'),'Pause');x.q('.rest-overlay').classList.add('is-minimized');x.w.dispatchEvent(new x.w.Event('setwerk:render'));await settle();assert.equal(x.q('.rest-overlay #setwerk-music'),null);assert.ok(x.q('.focus-shell > #setwerk-music'));x.q('.focus-shell').remove();x.w.dispatchEvent(new x.w.Event('setwerk:render'));assert.equal(x.q('#setwerk-music'),null);}finally{x.dom.window.close();}
});
test('polling preserves controls but updates a track changed outside Setwerk while a button is focused',async()=>{
 const x=setup();try{await settle();const button=x.q('[data-music-action=next]');button.focus();await x.w.SetwerkMusic.refresh();assert.equal(x.q('[data-music-action=next]'),button);x.setState({...fixture(),title:'Second Wind'});await x.w.SetwerkMusic.refresh();assert.equal(x.q('.music-track strong').textContent,'Second Wind');assert.equal(x.w.document.activeElement.dataset.musicAction,'next');}finally{x.dom.window.close();}
});
test('source logo and name follow the active music app and reject external image URLs',async()=>{
 const png='data:image/png;base64,iVBORw0KGgo=';const x=setup({...fixture(),appName:'Spotify',appIcon:png});
 try{await settle();assert.equal(x.q('.music-source small').textContent,'Spotify');assert.equal(x.q('.music-source-icon').getAttribute('src'),png);assert.equal(x.q('.music-source-icon').getAttribute('alt'),'');x.setState({...fixture(),sessionKey:'youtube:2',appName:'YouTube Music',appIcon:png});await x.w.SetwerkMusic.refresh();assert.equal(x.q('.music-source small').textContent,'YouTube Music');x.setState({...fixture(),appName:'Other player',appIcon:'https://untrusted.test/icon.png'});await x.w.SetwerkMusic.refresh();assert.equal(x.q('.music-source-icon'),null);assert.ok(x.q('.music-source svg'));assert.equal(x.q('.music-source small').textContent,'Other player');}finally{x.dom.window.close();}
});

test('exercise list hides music through navigation snapshots and restores it on return',async()=>{
 const x=setup();try{await settle();assert.ok(x.q('#setwerk-music'));
 const main=x.q('.focus-main');main.innerHTML='<div class="focus-workout-list">Übungen</div>';
 x.w.dispatchEvent(new x.w.Event('setwerk:render'));await settle();assert.equal(x.q('#setwerk-music'),null);
 await x.w.SetwerkMusic.refresh();assert.equal(x.q('#setwerk-music'),null);
 const snapshot=x.w.document.createElement('div');snapshot.className='focus-shell focus-navigation-snapshot';snapshot.innerHTML=main.innerHTML;x.w.document.body.prepend(snapshot);main.innerHTML='Workout';
 x.w.dispatchEvent(new x.w.Event('setwerk:render'));await settle();assert.ok(x.q('#setwerk-music'));assert.equal(snapshot.querySelector('#setwerk-music'),null);
 }finally{x.dom.window.close();}
});

test('compact dock shows title, pause and next; downward swipe expands and tapping title collapses',async()=>{
 const x=setup(fixture(),false);try{await settle();assert.equal(x.q('.music-mini-title strong').textContent,'Night Drive');assert.equal(x.q('.music-full'),null);assert.ok(x.q('[data-music-action=pause]'));assert.ok(x.q('[data-music-action=next]'));assert.equal(x.q('[data-music-action=previous]'),null);assert.equal(x.q('[data-music-seek]'),null);
 const title=x.q('.music-mini-title');for(const [type,y] of [['pointerdown',100],['pointerup',165]]){const e=new x.w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:7,clientX:100,clientY:y,isPrimary:true,button:0});title.dispatchEvent(e);}
 assert.ok(x.q('.music-full'));assert.ok(x.q('[data-music-seek]'));assert.ok(x.q('[data-music-action=previous]'));await x.w.SetwerkMusic.refresh();assert.ok(x.q('.music-full'));
 // A swipe-generated click must not immediately collapse the full view.
 x.q('[data-music-expand]').click();assert.ok(x.q('.music-full'));
 x.q('.focus-main').innerHTML='<div class="focus-workout-list">Übungen</div>';x.w.dispatchEvent(new x.w.Event('setwerk:render'));assert.equal(x.q('#setwerk-music'),null);x.q('.focus-main').innerHTML='Workout';x.w.dispatchEvent(new x.w.Event('setwerk:render'));await settle();assert.equal(x.q('.music-full'),null);
 x.dom.window.Date.now=()=>Date.now()+1000;x.q('[data-music-expand]').click();assert.ok(x.q('.music-full'));x.q('[data-music-expand]').click();assert.equal(x.q('.music-full'),null);
 }finally{x.dom.window.close();}
});
