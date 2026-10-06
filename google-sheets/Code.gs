/* Deploy as an Apps Script web app executing as the owner.
 * The spreadsheet stays private. Every request must carry a server HMAC.
 * Set SPREADSHEET_ID and SETWERK_SHEETS_SECRET in Script Properties.
 */
function jsonReply(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function constantEqual(a,b){
  if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
  var difference=0;for(var i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);
  return difference===0;
}
function doGet(){return jsonReply({status:405});}
function doPost(event){
  var lock;
  try{
    var props=PropertiesService.getScriptProperties();
    var secret=props.getProperty('SETWERK_SHEETS_SECRET'),spreadsheetId=props.getProperty('SPREADSHEET_ID');
    if(!secret||secret.length<32||!spreadsheetId)return jsonReply({status:503});
    var envelope=JSON.parse(event.postData.contents);
    if(typeof envelope.payload!=='string'||envelope.payload.length>2200000)return jsonReply({status:400});
    var signature=Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(envelope.payload,secret,Utilities.Charset.UTF_8)).replace(/=+$/,'');
    if(!constantEqual(signature,envelope.signature))return jsonReply({status:403});
    var request=JSON.parse(envelope.payload);
    if(request.version!==1||!Number.isFinite(request.timestamp)||Math.abs(Date.now()-request.timestamp)>300000||typeof request.userId!=='string'||! /^[A-Za-z0-9_-]{1,100}$/.test(request.userId)||!['read','write'].includes(request.operation))return jsonReply({status:400});
    lock=LockService.getScriptLock();
    if(!lock.tryLock(10000))return jsonReply({status:503});
    var spreadsheet=SpreadsheetApp.openById(spreadsheetId);
    var sheet=spreadsheet.getSheetByName('SetwerkAccounts');
    if(!sheet){sheet=spreadsheet.insertSheet('SetwerkAccounts');sheet.getRange(1,1,1,4).setValues([['user_id','revision','updated_at','data_1']]);sheet.setFrozenRows(1);}
    var rows=sheet.getDataRange().getValues(),rowIndex=-1;
    for(var i=1;i<rows.length;i++)if(rows[i][0]===request.userId){rowIndex=i;break;}
    var revision=rowIndex<0?0:Number(rows[rowIndex][1]);
    if(!Number.isSafeInteger(revision)||revision<0)return jsonReply({status:500});
    if(request.operation==='read'){
      if(rowIndex<0)return jsonReply({status:200,revision:0,data:null});
      var encoded=rows[rowIndex].slice(3).filter(function(cell){return String(cell).startsWith('b64:');}).map(function(cell){return String(cell).slice(4);}).join('');
      var data=JSON.parse(Utilities.newBlob(Utilities.base64Decode(encoded)).getDataAsString('UTF-8'));
      return jsonReply({status:200,revision:revision,data:data});
    }
    if(request.revision!==revision)return jsonReply({status:409});
    if(!request.data||request.data.version!==1||request.data.active||request.data.draft)return jsonReply({status:400});
    var raw=JSON.stringify(request.data);
    if(Utilities.newBlob(raw).getBytes().length>1048576)return jsonReply({status:413});
    var base64=Utilities.base64Encode(raw,Utilities.Charset.UTF_8),chunks=[];
    for(var offset=0;offset<base64.length;offset+=30000)chunks.push('b64:'+base64.slice(offset,offset+30000));
    var values=[request.userId,revision+1,new Date().toISOString()].concat(chunks);
    var width=Math.max(values.length,sheet.getLastColumn());
    while(values.length<width)values.push('');
    if(width>sheet.getMaxColumns())sheet.insertColumnsAfter(sheet.getMaxColumns(),width-sheet.getMaxColumns());
    var targetRow=rowIndex<0?sheet.getLastRow()+1:rowIndex+1;
    if(targetRow>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),1);
    sheet.getRange(targetRow,1,1,width).setValues([values]);
    SpreadsheetApp.flush();
    return jsonReply({status:200,revision:revision+1});
  }catch(error){return jsonReply({status:500});}
  finally{if(lock)lock.releaseLock();}
}
