const { chromium } = require('playwright');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const repo = path.join(__dirname, '..');
const root = path.join(repo, 'Setwerk-Webapp-1.2.0-Projektdateien/dist');
const screenshots=path.join(process.env.RUNNER_TEMP||require('node:os').tmpdir(),'setwerk-ui');fs.mkdirSync(screenshots,{recursive:true});
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server = http.createServer((req,res) => {
  let url = new URL(req.url,'http://localhost').pathname;
  const name=url==='/'?'index.html':url.slice(1);
  try {
    let content=fs.readFileSync(path.join(root,name));
    if(name==='index.html')content=content.toString().replace(/<script[^>]*src="(?:cloud.js|auth.js)"[^>]*><\/script>/g,'');
    res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');res.end(content);
  }catch{res.statusCode=404;res.end();}
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true});
  const origin='http://127.0.0.1:'+server.address().port;
  const errors=[],results=[];
  try {
    for(const width of [320,360,390,430,768,1440]){
      const page=await browser.newPage({viewport:{width,height:900},isMobile:width<700,hasTouch:width<700});
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(origin);
      await page.locator('[data-action=nav][data-route=templates]:visible').click();
      assert.equal(await page.locator('.template-grid > :first-child [data-action=new-template]').count(),1);
      assert.equal(await page.locator('.page-head [data-action=new-template]').count(),0);
      assert.equal(await page.locator('[data-action=new-template]').count(),1);
      const create=await page.locator('.template-create [data-action=new-template]').boundingBox();
      const imp=await page.locator('.template-import').boundingBox();
      assert(imp.y>=create.y+create.height);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`empty ${width}`);
      assert.equal(await page.evaluate(()=>innerWidth),width,`empty viewport ${width}`);
      await page.locator('.template-import').click();
      await page.locator('#workout-import-code').waitFor();
      await page.locator('[data-action=close-modal]').click();
      await page.locator('[data-action=new-template]').click();
      await page.locator('#draft-name').waitFor();
      await page.locator('#draft-name').fill('Mobiler Testplan');
      await page.locator('[data-draft=category]').selectOption('Ballsport');
      await page.locator('#editor-form button[type=submit]').click();
      assert.equal(await page.locator('.template-card').count(),1);
      const card=page.locator('.template-card').first();
      assert.deepEqual(await card.locator('footer [data-action]').evaluateAll(buttons=>buttons.map(b=>b.dataset.action)),['start-template','edit-template']);
      assert.equal(await card.locator('[data-action=export-template]').isVisible(),false);
      await card.locator('.template-menu summary').click();
      await card.locator('[data-action=export-template]').click();
      await page.locator('#modal').waitFor({state:'visible'});
      await page.locator('[data-action=close-modal]').click();
      await card.locator('.template-menu summary').click();
      await page.keyboard.press('Escape');
      assert.equal(await card.locator('.template-menu').getAttribute('open'),null);
      await card.locator('.template-menu summary').click();
      await page.locator('.page-head h1').click();
      assert.equal(await card.locator('.template-menu').getAttribute('open'),null);
      await card.locator('.template-menu summary').click();
      await card.locator('[data-action=copy-template]').click();
      assert.equal(await page.locator('.template-card').count(),2);
      const duplicate=page.locator('.template-card').last();
      await duplicate.locator('.template-menu summary').click();
      await duplicate.locator('[data-action=delete-template]').click();
      await page.locator('[data-action=confirm-delete-template]').click();
      assert.equal(await page.locator('.template-card').count(),1);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`populated ${width}`);
      await page.locator('[data-action=edit-template]').click();
      await page.locator('#draft-name').fill('SehrLangerVorlagennameOhneLeerzeichen'.repeat(5));
      await page.locator('#editor-form button[type=submit]').click();
      if(width<700)await page.addStyleTag({content:':root{font-size:20px}'});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`long title, large text ${width}`);
      assert.equal(await page.evaluate(()=>innerWidth),width,`large text viewport ${width}`);
      for(const action of ['start-template','edit-template']){
        const button=page.locator(`.template-card footer [data-action=${action}]`);
        assert.equal(await button.evaluate(el=>{
          const text=[...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
          const range=document.createRange();range.selectNodeContents(text);
          return range.getClientRects().length===1&&el.scrollWidth<=el.clientWidth;
        }),true,`single-line ${action} ${width}`);
      }
      await page.locator('.template-menu summary').click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`open menu ${width}`);
      await page.screenshot({path:path.join(screenshots,'templates-menu-'+width+'.png'),fullPage:true});
      await page.locator('.template-menu summary').click();
      await page.screenshot({path:path.join(screenshots,'templates-'+width+'.png'),fullPage:true});
      await page.locator('[data-action=start-template]').click();
      await page.locator('#activity-clock').waitFor();
      await page.evaluate(()=>{
        const chest=GYM_EXERCISES.filter(e=>e.muscle==='Brust'),back=GYM_EXERCISES.filter(e=>e.muscle==='Rücken'),legs=GYM_EXERCISES.find(e=>e.muscle==='Beine');
        const custom={id:'custom-summary',name:'Eigene Brustübung',muscle:'Brust',equipment:'Eigengewicht',kind:'reps',custom:true};
        const state=GymCore.fresh();state.customExercises=[custom];
        state.templates=[{id:'summary',name:'Oberkörper A',category:'Kraft',items:[GymCore.item(chest[0],1),GymCore.item(custom,10),GymCore.item(back[0],1),GymCore.item(back[1],1),GymCore.item(legs,1)]}];
        localStorage.setItem('setwerk.v1',JSON.stringify(state));
      });
      await page.reload();await page.locator('[data-action=nav][data-route=templates]:visible').click();
      if(width<700)await page.addStyleTag({content:':root{font-size:20px}'});
      assert.equal(await page.locator('.template-name').textContent(),'Oberkörper A');
      assert.equal(await page.locator('.template-summary .meta').textContent(),'5 Übungen · Brust / Rücken');
      assert.equal(await page.locator('.template-card li').count(),4);
      assert.equal(await page.locator('.template-card li').last().textContent(),'+ 2 weitere Übungen');
      assert.equal(await page.locator('.template-name').evaluate(el=>Number(getComputedStyle(el).fontWeight)>=700),true);
      const titleBox=await page.locator('.template-name').boundingBox(),badgeBox=await page.locator('.template-summary .badge').boundingBox();
      assert(badgeBox.y>=titleBox.y+titleBox.height);
      assert.equal(await page.evaluate(()=>innerWidth),width,`exercise summary viewport ${width}`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`exercise summary ${width}`);
      await page.screenshot({path:path.join(screenshots,'templates-summary-'+width+'.png'),fullPage:true});
      results.push({width,empty:true,populated:true,largeText:true,singleLineButtons:true,menu:true,share:true,duplicate:true,delete:true,create:true,edit:true,import:true,start:true,summary:true,muscleTie:true,threeExercisePreview:true});
      await page.close();
    }
    assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors}));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
