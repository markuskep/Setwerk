/* CI receives the deployment key through GitHub Secrets; never print it. */
import {createSign} from 'node:crypto';
import {readFile,appendFile} from 'node:fs/promises';
const project='setwerk-cb1e0',base='projects/'+project;
const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT||'{}');
if(!account.client_email||!account.private_key||account.project_id!==project)throw Error('Firebase deployment secret is missing or belongs to a different project.');
const now=Math.floor(Date.now()/1000);
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const unsigned=b64({alg:'RS256',typ:'JWT'})+'.'+b64({iss:account.client_email,scope:'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
const assertion=unsigned+'.'+createSign('RSA-SHA256').update(unsigned).sign(account.private_key,'base64url');
const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(30000)});
const token=await tokenResponse.json();if(!token.access_token)throw Error('Firebase deployment credentials could not be authenticated.');
async function api(url,method='GET',body){
 const response=await fetch(url,{method,headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
 let data={};try{data=await response.json();}catch{}
 return{ok:response.ok,status:response.status,data};
}
const report=[];
function note(message){report.push(message);console.log(message);}
function missing(action,result){note(action+' requires project-owner setup (HTTP '+result.status+').');}
const configURL='https://identitytoolkit.googleapis.com/admin/v2/'+base+'/config';
const auth=await api(configURL);
if(auth.ok&&auth.data.signIn?.email?.enabled&&auth.data.signIn?.email?.passwordRequired)note('Email/password sign-in is enabled.');
else{
 const updated=await api(configURL+'?updateMask=signIn.email','PATCH',{signIn:{email:{enabled:true,passwordRequired:true}}});
 if(updated.ok)note('Email/password sign-in has been enabled.');else missing('Enable Authentication > Email/Password',updated);
}
let database=await api('https://firestore.googleapis.com/v1/'+base+'/databases/(default)');
if(database.status===404){
 const created=await api('https://firestore.googleapis.com/v1/'+base+'/databases?databaseId=%28default%29','POST',{locationId:'europe-west3',type:'FIRESTORE_NATIVE'});
 if(created.ok){note('Firestore database creation started in Frankfurt (europe-west3).');database=await api('https://firestore.googleapis.com/v1/'+base+'/databases/(default)');}
 else{missing('Create the default Cloud Firestore database',created);database=created;}
}
if(database.ok){
 note('The default Firestore database is available.');
 const rulesURL='https://firebaserules.googleapis.com/v1/'+base;
 const rules=await api(rulesURL+'/rulesets','POST',{source:{files:[{name:'firestore.rules',content:await readFile('firestore.rules','utf8')}]}});
 if(rules.ok){
  const releaseName=base+'/releases/cloud.firestore',release=await api('https://firebaserules.googleapis.com/v1/'+releaseName);
  const applied=release.status===404
   ?await api(rulesURL+'/releases','POST',{name:releaseName,rulesetName:rules.data.name})
   :await api('https://firebaserules.googleapis.com/v1/'+releaseName+'?updateMask=rulesetName','PATCH',{name:releaseName,rulesetName:rules.data.name});
  if(applied.ok)note('Private per-account Firestore rules have been published.');else missing('Publish firestore.rules in the Firestore Rules tab',applied);
 }else missing('Publish firestore.rules in the Firestore Rules tab',rules);
}else missing('Create or enable the default Cloud Firestore database',database);
const configuration=await fetch('https://'+project+'.web.app/__/firebase/init.json',{signal:AbortSignal.timeout(30000)});
let publicConfig={};try{publicConfig=await configuration.json();}catch{}
if(configuration.ok&&publicConfig.projectId===project&&publicConfig.apiKey)note('Firebase Hosting supplies the correct browser configuration.');
else note('Register a Web app in Firebase Project settings so Hosting can supply browser configuration.');
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'## Firebase service setup\n\n'+report.map(line=>'- '+line).join('\n')+'\n');
