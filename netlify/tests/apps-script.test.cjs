const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const secret='s'.repeat(64),source=fs.readFileSync(require('node:path').join(__dirname,'../../google-sheets/Code.gs'),'utf8');
function setup(){
 const rows=[],sheet={getRange(row,col,height,width){return{setValues(values){for(let i=0;i<height;i++){rows[row-1+i]??=[];for(let j=0;j<width;j++)rows[row-1+i][col-1+j]=values[i][j];}}};},setFrozenRows(){},getDataRange(){return{getValues:()=>rows};},getLastColumn:()=>Math.max(0,...rows.map(r=>r.length)),getMaxColumns:()=>200,getMaxRows:()=>1000,getLastRow:()=>rows.length},spreadsheet={getSheetByName:()=>rows.length?sheet:null,insertSheet:()=>sheet};
 let opened=0,locked=false;const context={Date,ContentService:{MimeType:{JSON:'json'},createTextOutput(text){return{setMimeType:()=>({text})};}},PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='SETWERK_SHEETS_SECRET'?secret:'sheet-id'})},Utilities:{Charset:{UTF_8:'UTF-8'},computeHmacSha256Signature:(data,key)=>crypto.createHmac('sha256',key).update(data).digest(),base64EncodeWebSafe:bytes=>Buffer.from(bytes).toString('base64url'),base64Encode:raw=>Buffer.from(raw).toString('base64'),base64Decode:raw=>Buffer.from(raw,'base64'),newBlob:raw=>({getBytes:()=>Buffer.from(raw),getDataAsString:()=>Buffer.from(raw).toString('utf8')})},LockService:{getScriptLock:()=>({tryLock(){locked=true;return true;},releaseLock(){locked=false;}})},SpreadsheetApp:{openById(){assert.equal(locked,true);opened++;return spreadsheet;},flush(){}}};
 vm.createContext(context);vm.runInContext(source,context);
 const call=(payload,signature)=>{const raw=JSON.stringify({version:1,timestamp:Date.now(),...payload});return JSON.parse(context.doPost({postData:{contents:JSON.stringify({payload:raw,signature:signature??crypto.createHmac('sha256',secret).update(raw).digest('base64url')})}}).text);};
 return{call,rows,opened:()=>opened};
}
test('Apps Script verifies signatures/timestamps before reading the private sheet',()=>{
 const x=setup();assert.equal(x.call({userId:'alice',operation:'read'},'bad').status,403);assert.equal(x.call({userId:'alice',operation:'read',timestamp:Date.now()-600000}).status,400);assert.equal(x.opened(),0);
});
test('Apps Script keeps accounts separate and refuses stale revisions',()=>{
 const x=setup(),data={version:1,name:'Alice'};assert.deepEqual(x.call({userId:'alice',operation:'write',revision:0,data}),{status:200,revision:1});assert.equal(x.call({userId:'alice',operation:'write',revision:0,data:{version:1,name:'stale'}}).status,409);
 assert.deepEqual(x.call({userId:'bob',operation:'read'}),{status:200,revision:0,data:null});assert.deepEqual(x.call({userId:'alice',operation:'read'}).data,data);
});
test('Apps Script round-trips Unicode beyond the cell limit and clears old trailing chunks',()=>{
 const x=setup(),large={version:1,notes:'🏋️界'.repeat(18000)};assert.equal(x.call({userId:'alice',operation:'write',revision:0,data:large}).status,200);assert.ok(x.rows[1].length>4);assert.ok(x.rows[1].slice(3).every(cell=>cell.startsWith('b64:')&&cell.length<=30004));assert.deepEqual(x.call({userId:'alice',operation:'read'}).data,large);
 const small={version:1,notes:'=IMPORTDATA("private")'};assert.equal(x.call({userId:'alice',operation:'write',revision:1,data:small}).status,200);assert.deepEqual(x.call({userId:'alice',operation:'read'}).data,small);assert.ok(x.rows[1].slice(4).every(cell=>cell===''));
});
test('Apps Script refuses unfinished workouts and oversized account data',()=>{
 const x=setup();assert.equal(x.call({userId:'alice',operation:'write',revision:0,data:{version:1,active:{}}}).status,400);assert.equal(x.call({userId:'alice',operation:'write',revision:0,data:{version:1,notes:'a'.repeat(1048576)}}).status,413);assert.equal(x.call({userId:'=FORMULA',operation:'read'}).status,400);
});
