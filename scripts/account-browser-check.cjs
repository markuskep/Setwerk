const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../Setwerk-Webapp-1.2.0-Projektdateien/dist');
const screenshots=path.join(process.env.RUNNER_TEMP||require('node:os').tmpdir(),'setwerk-ui');fs.mkdirSync(screenshots,{recursive:true});
const mock=`let user={id:'visual-user',email:'markus@example.test',name:'Markus'},listener;const stores={};
export async function getUser(){return user;}export async function subscribeAuth(fn){listener=fn;fn(user);}
export async function signup(email,password,name){return user={id:'visual-user',email,name};}export async function login(email,password){return user={id:'visual-user',email,name:'Markus'};}export async function logout(){user=null;listener(null);}
export async function resetPassword(){}export async function updateUserProfile(name){user={...user,name};return user;}export async function changePassword(current,password){if(current!=='test-password')throw Object.assign(Error('wrong'),{code:'auth/invalid-credential'});window.__passwordChanged=password;}
export async function removeAccount(password){if(password!=='test-password')throw Object.assign(Error('wrong'),{code:'auth/invalid-credential'});window.__accountRemoved=true;await logout();}
window.SetwerkFirebase={async readStore(owner){return stores[owner]||{revision:0,data:null};},async writeStore(owner,revision,data){stores[owner]={revision:revision+1,data:JSON.parse(JSON.stringify(data))};return{revision:revision+1,data:null};}};`;
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
(async()=>{
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/firebase-service.js'){res.setHeader('Content-Type','text/javascript');return res.end(mock);}const file=path.join(root,url.pathname==='/'?'index.html':url.pathname);if(!file.startsWith(root)){res.statusCode=403;return res.end();}try{res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;try{
browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>document.querySelector('[data-auth-state="signed-in"]')&&window.SetwerkCloud.mode==='synced');
await page.locator('.sidebar-auth-button').click();assert.deepEqual(await page.locator('#account-menu button').allTextContents(),['Kontodaten','Abmelden','Konto löschen']);
await page.screenshot({path:path.join(screenshots,'desktop-menu.png')});await page.keyboard.press('Escape');
const photo=await page.locator('.start-card').screenshot();await page.locator('.sidebar-auth-button').click();await page.getByRole('menuitem',{name:'Kontodaten'}).click();
await page.locator('[name=profileName]').fill('Markus K.');await page.locator('#profile-photo').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:photo});
await page.waitForFunction(()=>document.querySelector('#profile-preview').src.startsWith('data:image/jpeg')&&!document.querySelector('#profile-photo').disabled);
await page.locator('#profile-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#account-message').textContent.includes('Profil gespeichert')&&!document.querySelector('#profile-photo').disabled);
assert.equal(await page.evaluate(()=>SetwerkCloud.profile.name),'Markus K.');assert.ok((await page.evaluate(()=>SetwerkCloud.profile.photo)).length<100000);
await page.screenshot({path:path.join(screenshots,'account-details.png')});await page.locator('[data-account-action=close]').click();assert.match(await page.locator('.sidebar-auth-button').textContent(),/Markus K/);
await page.getByRole('switch').click();assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.equal(await page.getByRole('switch').getAttribute('aria-checked'),'true');await page.getByRole('switch').click();
await page.setViewportSize({width:390,height:844});await page.locator('.mobile-account [data-auth-open]').click();await page.screenshot({path:path.join(screenshots,'mobile-menu.png')});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);const bounds=await page.locator('#account-menu').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
await page.getByRole('menuitem',{name:'Kontodaten'}).click();await page.screenshot({path:path.join(screenshots,'mobile-details.png')});
await page.locator('[name=currentPassword]').fill('wrong-password');await page.locator('[name=newPassword]').fill('new-password');await page.locator('[name=repeatPassword]').fill('different-password');await page.locator('#password-form button').click();assert.match(await page.locator('#account-message').textContent(),/stimmen nicht/);
await page.locator('[name=repeatPassword]').fill('new-password');await page.locator('#password-form button').click();await page.waitForFunction(()=>document.querySelector('#account-message').textContent.includes('stimmt nicht'));assert.equal(await page.locator('[name=currentPassword]').inputValue(),'');
await page.locator('[name=currentPassword]').fill('test-password');await page.locator('[name=newPassword]').fill('new-password');await page.locator('[name=repeatPassword]').fill('new-password');await page.locator('#password-form button').click();await page.waitForFunction(()=>window.__passwordChanged==='new-password');
await page.locator('[data-account-action=delete]').click();await page.locator('#delete-password').fill('test-password');await page.locator('#delete-account-form button').click();assert.equal(await page.evaluate(()=>!!window.__accountRemoved),false);
await page.locator('[name=confirmDeletion]').check();await page.locator('#delete-account-form button').click();await page.waitForFunction(()=>window.__accountRemoved);
assert.deepEqual(errors,[]);console.log(JSON.stringify({browserChecks:'passed',desktop:1440,mobile:390,imageUpload:'192px JPEG',profileSaved:true,passwordChanged:true,deletionRequiresConfirmation:true,pageErrors:errors}));
}finally{await browser?.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
