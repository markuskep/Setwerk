const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup({wrongPassword=false,deleteFailure=false}={}){
 const calls=[],user={uid:'alice',email:'alice@example.test'},auth={currentUser:user},previous={revision:4,data:{private:'workouts'}};
 const resources={auth,authSDK:{EmailAuthProvider:{credential:(email,password)=>({email,password})},async reauthenticateWithCredential(value,credential){calls.push(['reauth',value.uid,credential.password]);if(wrongPassword)throw Object.assign(Error('Wrong password'),{code:'auth/invalid-credential'});},async updatePassword(value,password){calls.push(['password',value.uid,password]);},async deleteUser(value){calls.push(['delete',value.uid]);if(deleteFailure)throw Object.assign(Error('Network unavailable'),{code:'auth/network-request-failed'});auth.currentUser=null;}},store:{async erase(owner){calls.push(['erase',owner]);return previous;},async restore(owner,revision,data){calls.push(['restore',owner,revision,data]);}}};
 resources.db={};resources.storeSDK={doc:(db,...parts)=>parts.join('/'),serverTimestamp:()=> 'server-time',async getDocFromServer(ref){calls.push(['appearance-read',ref]);return{exists:()=>true,data:()=>({theme:'cherry'})}},async setDoc(ref,data){calls.push(['appearance-write',ref,data])}};
 const window={__resources:resources,SetwerkCloud:{async beginAccountDeletion(owner){calls.push(['pause',owner]);return()=>calls.push(['resume']);},forgetAccount(owner){calls.push(['forget',owner]);}}};
 let source=fs.readFileSync(path.join(__dirname,'../dist/firebase-service.js'),'utf8');const start=source.indexOf('async function resources(){'),end=source.indexOf('export async function getUser()',start);
 source=source.slice(0,start)+'async function resources(){return window.__resources;}\n'+source.slice(end);
 source=source.replace(/^export /gm,'')+'\nglobalThis.api={removeAccount,changePassword,readAppearance,writeAppearance};';const context={window};vm.runInNewContext(source,context);
 return{calls,api:context.api,previous};
}
test('a wrong current password prevents changing credentials or deleting any data',async()=>{
 const x=setup({wrongPassword:true});await assert.rejects(x.api.removeAccount('wrong'),e=>e.code==='auth/invalid-credential');assert.deepEqual(x.calls,[['reauth','alice','wrong']]);
 const y=setup({wrongPassword:true});await assert.rejects(y.api.changePassword('wrong','new-password'));assert.deepEqual(y.calls,[['reauth','alice','wrong']]);
});
test('account deletion reauthenticates, pauses uploads, removes data, deletes credentials and then forgets local data',async()=>{
 const x=setup();await x.api.removeAccount('current-password');assert.deepEqual(x.calls,[['reauth','alice','current-password'],['pause','alice'],['erase','alice'],['delete','alice'],['forget','alice'],['resume']]);
});
test('failed credential deletion restores cloud data and retains the local account cache',async()=>{
 const x=setup({deleteFailure:true});await assert.rejects(x.api.removeAccount('current-password'),e=>e.code==='auth/network-request-failed');assert.deepEqual(x.calls.at(-2),['restore','alice',5,x.previous.data]);assert.deepEqual(x.calls.at(-1),['resume']);assert.equal(x.calls.some(c=>c[0]==='forget'),false);
});
test('password change uses the current password before updating the captured account',async()=>{
 const x=setup();await x.api.changePassword('current-password','new-password');assert.deepEqual(x.calls,[['reauth','alice','current-password'],['password','alice','new-password']]);
});

test('appearance uses a separate owner document and never writes the workout snapshot',async()=>{
 const x=setup();assert.equal(await x.api.readAppearance('alice'),'cherry');await x.api.writeAppearance('alice','orange');assert.equal(x.calls[0][1],'users/alice/preferences/appearance');assert.equal(x.calls[1][0],'appearance-write');assert.equal(x.calls[1][1],'users/alice/preferences/appearance');assert.equal(x.calls[1][2].theme,'orange');
 await assert.rejects(x.api.readAppearance('bob'));await assert.rejects(x.api.writeAppearance('bob','cherry'));await assert.rejects(x.api.writeAppearance('alice','unsupported'));assert.equal(x.calls.length,2);
});
