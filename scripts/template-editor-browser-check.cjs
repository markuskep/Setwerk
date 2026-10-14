const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../Setwerk-Webapp-1.2.0-Projektdateien/dist');
const output=path.join(process.env.RUNNER_TEMP||require('node:os').tmpdir(),'setwerk-template-editor');fs.mkdirSync(output,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!/^[\w.-]+$/.test(name)){res.statusCode=404;return res.end();}try{let content=fs.readFileSync(path.join(root,name));if(name==='index.html')content=content.toString().replace(/<script[^>]*src="(?:cloud.js|auth.js)"[^>]*><\/script>/g,'');res.setHeader('Content-Type',types[path.extname(name)]||'application/json');res.end(content);}catch{res.statusCode=404;res.end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true}),errors=[],results=[];
 try{for(const [width,height] of [[320,740],[390,844],[430,932],[1440,900]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:width<700,hasTouch:width<700});page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
  await page.locator('[data-action=new-template]').first().click();await page.locator('#draft-name').fill('Oberkörper A');
  await page.locator('[data-action=pick-exercise]:visible').first().click();const ids=await page.evaluate(()=>GYM_EXERCISES.filter(e=>e.kind==='reps').slice(0,3).map(e=>e.id));
  await page.locator(`[data-action=choose-exercise][data-id="${ids[0]}"]`).click();
  assert.equal(await page.locator('.set-type').count(),0);assert.deepEqual(await page.locator('.template-exercise .set-table').first().locator('th').allTextContents(),['Satz','Wdh.','kg','']);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('.template-exercise .set-scroll').first().evaluate(el=>el.scrollWidth>el.clientWidth),false);
  await page.locator('#toast').evaluate(el=>el.classList.remove('show'));
  await page.screenshot({path:path.join(output,`editor-single-${width}.png`),fullPage:true});
  if(width<700){
   for(const selector of ['#draft-name','[data-draft=category]','[data-field=reps]','[data-field=weight]','.exercise-rest input','[data-insert="1"]','#editor-form button[type=submit]']){
    const box=await page.locator(selector+':visible').first().boundingBox(),nav=await page.locator('.bottom-nav').boundingBox();console.log(JSON.stringify({width,selector,box,nav}));assert(box.y>=0&&box.y+box.height<=nav.y,`important control fits: ${selector} ${width}`);
   }
   const plus=await page.locator('[data-insert="1"]').boundingBox(),save=await page.locator('.save-bar').boundingBox();assert(plus.y+plus.height<=save.y,`save controls do not cover insertion ${width}`);
  }
  await page.screenshot({path:path.join(output,`editor-single-${width}.png`),fullPage:true});
  await page.locator('[data-item="0"][data-set="0"][data-field=reps]').fill('12');await page.locator('[data-item="0"][data-set="0"][data-field=weight]').fill('42.5');
  await page.locator('[data-insert="1"]').click();await page.locator(`[data-action=choose-exercise][data-id="${ids[2]}"]`).click();
  await page.locator('[data-insert="1"]').click();await page.locator(`[data-action=choose-exercise][data-id="${ids[1]}"]`).click();
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('setwerk.v1')).draft.items.map(it=>it.exerciseId)),ids);
  if(width<700){assert.equal(await page.locator('.template-exercise>.exercise-edit-body:visible').count(),1);await page.locator('[data-action=toggle-template-item][data-item="0"]').click();assert.equal(await page.locator('[data-item="0"][data-set="0"][data-field=weight]').inputValue(),'42.5');}
  await page.locator('#toast').evaluate(el=>el.classList.remove('show'));
  await page.screenshot({path:path.join(output,`editor-three-${width}.png`),fullPage:true});
  await page.locator('#editor-form button[type=submit]').click();assert.equal(await page.locator('.template-card').count(),1);
  await page.reload();await page.locator('[data-action=nav][data-route=templates]:visible').click();await page.locator('[data-action=edit-template]').click();
  assert.equal(await page.locator('[data-item="0"][data-set="0"][data-field=weight]').inputValue(),'42.5');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('[data-action=toggle-template-item][data-item="0"]').click();await page.locator('.template-extra').first().locator('summary').first().click();await page.locator('[data-field=notes]').first().fill('Sitzhöhe 4');
  await page.locator('#editor-form button[type=submit]').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('setwerk.v1')).templates[0].items[0].notes),'Sitzhöhe 4');
  results.push({width,height,compactFields:true,insertionOrder:true,persistence:true,noHorizontalScroll:true});await page.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
