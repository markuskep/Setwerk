const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),T=require('../assets/transfer.js');
const root=path.resolve(__dirname,'../assets'),screens=path.resolve(__dirname,'../validation-screenshots');fs.mkdirSync(screens,{recursive:true});
const act=name=>`[data-action="${name}"]`;
(async()=>{
 const errors=[],exports=[],calls=[];let remote={revision:0,data:null},user={id:'browser-phone',email:'phone@example.test',name:'Phone'},offline=false;
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await context.exposeBinding('nativeRequest',async(_source,operation,body)=>{
   calls.push(operation);let status=200,data={};
   if(offline){status=502;data={code:'auth/network-request-failed'};}
   else if(operation==='identity-user')data={user};
   else if(operation==='identity-login'||operation==='identity-signup'){user={id:'browser-phone',email:body.email,name:body.name||'Phone'};data=user;}
   else if(operation==='identity-profile'){user={...user,name:body.name};data=user;}
   else if(operation==='identity-logout')user=null;
   else if(operation==='cloud-read')data=remote;
   else if(operation==='cloud-write'){assert.equal(body.revision,remote.revision);remote={revision:remote.revision+1,data:body.data};data={revision:remote.revision,data:null};}
   else if(operation==='legacy-list')data={accounts:[]};
   return{status,data};
  });
  await context.exposeBinding('nativeExport',async(_source,name,data)=>{exports.push({name,bundle:T.parse(Buffer.from(data,'base64').toString('utf8'))});});
  await context.addInitScript(()=>{
   const storage=window.localStorage,key=k=>k==='setwerk.v1'?k:'native.firebase|'+k;
   window.AndroidGym={storageGet:k=>storage.getItem(key(k)),storageSet:(k,v)=>{storage.setItem(key(k),v);return true;},storageRemove:k=>{storage.removeItem(key(k));return true;},
    readState:()=>{throw Error('Guest bypass');},writeState:()=>{throw Error('Guest bypass');},getSite:()=> 'https://setwerk-cb1e0.web.app',accountSettings:()=>{},scheduleRest:()=>{},cancelRest:()=>{},setReminders:()=>{},
    request:(id,operation,raw)=>window.nativeRequest(operation,JSON.parse(raw)).then(({status,data})=>window.SetwerkNative.receive(id,status,JSON.stringify(data))),saveFile:(name,data)=>window.nativeExport(name,data)};
  });
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='appassets.androidplatform.net'&&url.pathname.startsWith('/assets/')){
    const name=url.pathname.slice('/assets/'.length),f=path.join(root,name);if(!/^[a-zA-Z0-9_.-]+$/.test(name)||!fs.existsSync(f))return route.fulfill({status:404,body:''});
    const mime=name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.svg')?'image/svg+xml':name.endsWith('.png')?'image/png':name.endsWith('.html')?'text/html':'application/json';
    return route.fulfill({status:200,contentType:mime,body:fs.readFileSync(f)});
   }
   throw Error('Unexpected WebView request '+url.hostname);
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto('https://appassets.androidplatform.net/assets/index.html');await page.waitForFunction(()=>window.SetwerkCloud.mode==='synced');
  await page.locator(act('nav-calendar')).first().click();assert.equal(await page.locator(act('import-workout')).count(),0);
  await page.locator('[data-action=nav][data-route=home]:visible').first().click();await page.locator(act('new-template')+':visible').first().click();await page.locator('#draft-name').fill('Schwimmintervalle');await page.locator('[data-draft=category]').selectOption('Ausdauer');await page.locator('[data-cardio=mode]').selectOption('interval');await page.locator('[data-cardio=type]').selectOption('Schwimmen');
  assert.equal(await page.locator(act('pick-exercise')).count(),0);assert.equal(await page.locator('[data-cardio=elevationM]').count(),0);
  await page.locator('[data-cardio=count]').fill('8');await page.locator('[data-cardio=workSeconds]').fill('120');await page.locator('[data-cardio=restSeconds]').fill('30');assert.equal(await page.locator('[data-draft=durationMinutes]').inputValue(),'19.5');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(screens,'android-cardio-intervals.png'),fullPage:true});
  await page.locator('#editor-form button[type=submit]').click();await page.waitForFunction(()=>window.SetwerkCloud.mode==='synced');assert.equal(remote.data.templates[0].cardio.intervals.count,8);
  const before=calls.filter(x=>x.startsWith('cloud-')).length;await page.locator(act('start-template')).click();await page.locator('#activity-clock').waitFor();await page.evaluate(()=>window.dispatchEvent(new Event('setwerk:resume')));await page.waitForTimeout(100);assert.equal(calls.filter(x=>x.startsWith('cloud-')).length,before);
  await page.locator('main '+act('activity-finish')).click();await page.locator('[name=minutes]').fill('24');await page.locator('[name=distanceKm]').fill('0.8');await page.locator('#activity-finish-form button[type=submit]').click();await page.locator(act('skip-feedback')).click();await page.waitForFunction(()=>window.SetwerkCloud.mode==='synced');assert.equal(remote.data.sessions[0].duration,1440);
  await page.getByRole('button',{name:'Zur Übersicht',exact:true}).click();await page.getByRole('button',{name:'Vorlagen',exact:true}).click();await page.locator(act('export-template')+':visible').first().click();await page.locator(act('export-file')).click();await page.waitForTimeout(100);assert.equal(exports.length,1);assert.equal(exports[0].bundle.workout.cardio.mode,'interval');assert.match(exports[0].name,/\.setwerk\.json$/);await page.locator(act('close-modal')).click();
  await page.locator(act('import-workout')).click();await page.locator('#workout-import-file').setInputFiles({name:'import.setwerk.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...exports[0].bundle,workout:{...exports[0].bundle.workout,name:'Importtest'}}))});await page.locator('[data-action=confirm-import][data-target=template]').click();await page.waitForFunction(()=>window.SetwerkCloud.mode==='synced');assert.equal(remote.data.templates.length,2);
  await page.locator(act('new-template')+':visible').first().click();await page.locator('[data-draft=category]').selectOption('Ballsport');await page.locator('#draft-name').fill('Volleyball');await page.locator('[data-draft=durationMinutes]').fill('90');await page.locator('[data-draft=notes]').fill('Teamtraining');assert.equal(await page.locator(act('pick-exercise')).count(),0);assert.equal(await page.locator('[data-cardio=type]').count(),0);await page.screenshot({path:path.join(screens,'android-ballsport.png'),fullPage:true});await page.locator('#editor-form button[type=submit]').click();await page.waitForFunction(()=>window.SetwerkCloud.mode==='synced');
  await page.locator('[data-auth-open]:visible').click();await page.getByRole('menuitem',{name:'Kontodaten',exact:true}).click();await page.locator('[name=profileName]').fill('Android Test');await page.locator('#profile-photo').setInputFiles(path.join(root,'icon-192.png'));await page.waitForFunction(()=>document.querySelector('#profile-preview').src.startsWith('data:image/jpeg'));await page.locator('#profile-form button[type=submit]').click();await page.waitForFunction(()=>window.SetwerkCloud.profile?.name==='Android Test'&&window.SetwerkCloud.mode==='synced');assert.ok(remote.data.profile.photo.startsWith('data:image/jpeg'));assert.equal(await page.locator('#password-form').count(),1);assert.equal(await page.locator('#delete-account-form').count(),1);await page.screenshot({path:path.join(screens,'android-account.png'),fullPage:true});await page.locator('[data-account-action=close]').click();
  offline=true;await page.reload();await page.waitForFunction(()=>window.SetwerkCloud.mode==='offline');assert.equal(await page.locator('.template-card').count(),0);await page.getByRole('button',{name:'Vorlagen',exact:true}).click();assert.equal(await page.locator('.template-card').count(),3);
  offline=false;await page.evaluate(()=>window.dispatchEvent(new Event('setwerk:resume')));await page.waitForFunction(()=>window.SetwerkCloud.mode==='synced');assert.deepEqual(errors,[]);
  const result={browser:'Chromium at Android asset origin',viewport:390,calendarImportRemoved:true,cardioFields:true,ballsportFields:true,uploadsAfterCompletion:true,exportAndFileImport:true,profilePhoto:true,offlineReopen:true,pageErrors:errors};fs.writeFileSync(path.join(__dirname,'../browser-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
