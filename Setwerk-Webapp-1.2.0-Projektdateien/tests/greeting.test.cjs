const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
function setup(){
 const dom=new JSDOM('<html lang="de"><body><header data-welcome><div data-welcome-greeting></div><h1 data-welcome-message></h1><div class="head-actions"></div></header></body></html>',{url:'https://setwerk.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 let minutes=0,timer;const NativeDate=w.Date;
 w.Date=class extends NativeDate{getHours(){return Math.floor(minutes/60)}getMinutes(){return minutes%60}static now(){return 0}};
 w.setTimeout=fn=>{timer=fn;return 1};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
 w.SetwerkCloud={user:null,profile:null};
 w.eval(fs.readFileSync(path.join(__dirname,'../dist/greeting.js'),'utf8'));
 const query=s=>w.document.querySelector(s),small=()=>query('[data-welcome-greeting]').textContent,large=()=>query('[data-welcome-message]').textContent;
 function clock(value){const [h,m]=value.split(':').map(Number);minutes=h*60+m;timer()}
 function connect(user,profile=null){w.SetwerkCloud.user=user;w.SetwerkCloud.profile=profile;w.SetwerkGreeting.connect(user)}
 function preview(value){query('[data-greeting-clock]').click();query('[name=greetingTime]').value=value;query('#greeting-clock form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}))}
 return{dom,w,query,small,large,clock,connect,preview};
}
test('welcome follows all nine local time periods at both ends, including midnight',()=>{
 const x=setup();try{
 const periods=[
  ['04:00','06:59','Guten Morgen','Der frühe Vogel fängt den Wurm'],
  ['07:00','08:59','Guten Morgen','Perfekter Zeitpunkt für ein Workout'],
  ['09:00','10:59','Hallo','Wünsche einen schönen Vormittag'],
  ['11:00','12:59','Hallo','Schon Mittaggegessen?'],
  ['13:00','16:59','Schönen Nachmittag','Vergiss nicht, auch mal Pausen einzulegen'],
  ['17:00','19:59','Schönen Abend','Wie war dein Tag heute?'],
  ['20:00','21:59','Schönen Abend','Spätes Workout oder früh ins Bett gehen?'],
  ['22:00','00:59','Gute Nacht','Morgen nichts vor oder schlaflose Nacht?'],
  ['01:00','03:59','Hi','Es gibt keinen schlechten Zeitpunkt für Sport']
 ];
 for(const [start,end,small,large] of periods)for(const time of [start,end]){x.clock(time);assert.equal(x.small(),small,time);assert.equal(x.large(),large,time)}
 x.clock('23:59');assert.equal(x.small(),'Gute Nacht');x.clock('00:00');assert.equal(x.small(),'Gute Nacht');
 assert.equal(x.query('[data-greeting-clock]'),null);
 }finally{x.dom.window.close()}
});
test('authenticated names update safely from profile data and disappear on sign-out',()=>{
 const x=setup();try{
 x.clock('08:00');x.connect({id:'alice',email:'alice@example.test',name:'Alice'});assert.equal(x.small(),'Guten Morgen Alice');
 x.w.SetwerkCloud.profile={name:'<img src=x onerror=alert(1)>'};x.w.dispatchEvent(new x.w.Event('setwerk:cloud-status'));
 assert.equal(x.small(),'Guten Morgen <img src=x onerror=alert(1)>');assert.equal(x.query('[data-welcome-greeting] img'),null);
 x.connect({id:'bob',email:'bob@example.test',name:'Bob'});assert.equal(x.small(),'Guten Morgen Bob');
 x.connect(null);assert.equal(x.small(),'Guten Morgen');x.connect({id:'unnamed',email:'no-name@example.test',name:''});assert.equal(x.small(),'Guten Morgen');
 }finally{x.dom.window.close()}
});
test('only the specified signed-in account can preview time; reset and account switch restore the real clock',()=>{
 const x=setup();try{
 x.clock('14:00');x.connect({id:'other',email:'markus@example.test',name:'Markus'});assert.equal(x.query('[data-greeting-clock]'),null);
 x.connect({id:'markus',email:'markusk302@gmail.com',name:'Markus'});assert.ok(x.query('[data-greeting-clock]'));x.preview('00:30');assert.equal(x.small(),'Gute Nacht Markus');assert.equal(x.query('[data-greeting-clock]').getAttribute('aria-pressed'),'true');
 x.clock('08:00');assert.equal(x.small(),'Gute Nacht Markus');x.query('[data-greeting-clock]').click();x.query('[data-greeting-reset]').click();assert.equal(x.small(),'Guten Morgen Markus');assert.equal(x.query('[data-greeting-clock]').getAttribute('aria-pressed'),'false');
 x.preview('03:00');x.query('[data-greeting-clock]').click();x.connect({id:'other',email:'other@example.test',name:'Someone'});assert.equal(x.query('#greeting-clock').open,false);assert.equal(x.small(),'Guten Morgen Someone');assert.equal(x.query('[data-greeting-clock]'),null);
 x.connect({id:'markus',email:'markusk302@gmail.com',name:'Markus'});assert.equal(x.small(),'Guten Morgen Markus');x.connect(null);assert.equal(x.small(),'Guten Morgen');assert.equal(x.query('[data-greeting-clock]'),null);
 }finally{x.dom.window.close()}
});
test('welcome and preview controls follow the selected language without translating names',()=>{
 const x=setup();try{
 x.clock('18:00');x.connect({id:'markus',email:'markusk302@gmail.com',name:'Markus'});x.w.document.documentElement.lang='en';x.w.dispatchEvent(new x.w.Event('setwerk:render'));
 assert.equal(x.small(),'Good evening Markus');assert.equal(x.large(),'How was your day today?');assert.equal(x.query('[data-greeting-clock]').textContent,'Test greeting time');
 x.query('[data-greeting-clock]').click();assert.equal(x.query('#greeting-clock-title').textContent,'Test greeting time');assert.equal(x.query('[data-greeting-reset]').textContent,'Use current time');
 }finally{x.dom.window.close()}
});
